import json
import os
import struct


ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PROJECT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(PROJECT_DIR, "public", "assets", "data")
ROUTE_SOURCE_DIR = os.path.join(ROOT_DIR, "\u8def\u7ebf\u6570\u636e")
EVENT_SOURCE_DIR = os.path.join(ROOT_DIR, "\u91cd\u8981\u4e8b\u4ef6\u70b9")
ROUTE_OUTPUT_DIR = os.path.join(DATA_DIR, "route-layers")


ROUTE_COLORS = [
    "#b42318",
    "#cf6f18",
    "#8f1d14",
    "#365f91",
    "#9d6b1f",
    "#6b8e23",
    "#7a3e9d",
    "#b55a30",
    "#455a64",
    "#c43e35",
    "#2c7a7b",
    "#805ad5",
]


def read_cpg(path):
    cpg_path = os.path.splitext(path)[0] + ".cpg"

    if not os.path.exists(cpg_path):
        return "utf-8"

    with open(cpg_path, "rb") as file:
        text = file.read().decode("ascii", errors="ignore").strip()

    return text or "utf-8"


def decode_text(value, encoding):
    raw = value.rstrip(b"\x00").strip()

    if not raw:
        return ""

    for current_encoding in [encoding, "utf-8", "gbk", "cp936"]:
        try:
            return raw.decode(current_encoding).strip()
        except UnicodeDecodeError:
            continue

    return raw.decode("utf-8", errors="replace").strip()


def parse_number(text):
    if text == "":
        return None

    try:
        number = float(text)
    except ValueError:
        return text

    if number.is_integer():
        return int(number)

    return number


def parse_date(text):
    if len(text) == 8 and text.isdigit():
        return "{}-{}-{}".format(text[0:4], text[4:6], text[6:8])

    return text


def read_dbf(dbf_path):
    encoding = read_cpg(dbf_path)

    with open(dbf_path, "rb") as file:
        header = file.read(32)
        record_count = struct.unpack("<I", header[4:8])[0]
        header_length = struct.unpack("<H", header[8:10])[0]
        record_length = struct.unpack("<H", header[10:12])[0]
        fields = []

        while True:
            descriptor = file.read(32)

            if not descriptor or descriptor[0] == 0x0D:
                break

            raw_name = descriptor[:11].split(b"\x00", 1)[0]
            name = decode_text(raw_name, encoding)

            fields.append(
                {
                    "name": name,
                    "type": chr(descriptor[11]),
                    "length": descriptor[16],
                    "decimal": descriptor[17],
                }
            )

        file.seek(header_length)
        records = []

        for _ in range(record_count):
            record = file.read(record_length)

            if not record or record[0:1] == b"*":
                continue

            offset = 1
            item = {}

            for field in fields:
                size = field["length"]
                raw_value = record[offset : offset + size]
                offset += size

                text = decode_text(raw_value, encoding)

                if field["type"] in ["N", "F", "I", "O"]:
                    value = parse_number(text)
                elif field["type"] == "D":
                    value = parse_date(text)
                else:
                    value = text

                item[field["name"]] = value

            records.append(item)

    return {
        "fields": fields,
        "records": records,
    }


def read_shp_header(file):
    file.seek(32)
    shape_type = struct.unpack("<i", file.read(4))[0]
    file.seek(100)

    return shape_type


def read_point(content):
    x, y = struct.unpack("<dd", content[4:20])

    return {
        "type": "Point",
        "coordinates": [x, y],
    }


def read_polyline(content):
    box_end = 4 + 32
    part_count, point_count = struct.unpack("<ii", content[box_end : box_end + 8])
    parts_offset = box_end + 8
    points_offset = parts_offset + part_count * 4
    parts = list(struct.unpack("<{}i".format(part_count), content[parts_offset:points_offset]))
    points = []

    for index in range(point_count):
        offset = points_offset + index * 16
        x, y = struct.unpack("<dd", content[offset : offset + 16])
        points.append([x, y])

    lines = []

    for index, start in enumerate(parts):
        end = parts[index + 1] if index + 1 < len(parts) else point_count
        lines.append(points[start:end])

    if len(lines) == 1:
        return {
            "type": "LineString",
            "coordinates": lines[0],
        }

    return {
        "type": "MultiLineString",
        "coordinates": lines,
    }


def read_shp(shp_path):
    geometries = []

    with open(shp_path, "rb") as file:
        shape_type = read_shp_header(file)

        while True:
            record_header = file.read(8)

            if len(record_header) < 8:
                break

            _, content_length_words = struct.unpack(">ii", record_header)
            content = file.read(content_length_words * 2)

            if len(content) < 4:
                continue

            record_shape_type = struct.unpack("<i", content[:4])[0]

            if record_shape_type == 0:
                geometries.append(None)
            elif record_shape_type == 1:
                geometries.append(read_point(content))
            elif record_shape_type in [3, 13, 23]:
                geometries.append(read_polyline(content))
            else:
                raise ValueError("Unsupported shape type: {}".format(record_shape_type))

    return {
        "shapeType": shape_type,
        "geometries": geometries,
    }


def slugify_route_name(name):
    mapping = {
        "\u4e2d\u592e\u7eb5\u961f\u8def\u7ebf\u56fe": "route_zhongyang_zongdui",
        "\u7ea2\u4e00\u519b\u56e2\u8def\u7ebf\u56fe": "route_hongyi_juntuan",
        "\u7ea2\u4e09\u519b\u56e2\u8def\u7ebf\u56fe": "route_hongsan_juntuan",
        "\u7ea2\u4e94\u519b\u56e2\u8def\u7ebf\u56fe": "route_hongwu_juntuan",
        "\u7ea2\u4e5d\u519b\u56e2\u8def\u7ebf\u56fe": "route_hongjiu_juntuan",
        "\u7ea2\u4e8c\u519b\u56e2\u8def\u7ebf\u56fe": "route_honger_juntuan",
        "\u7ea2\u56db\u519b\u56e2\u8def\u7ebf\u56fe": "route_hongsi_juntuan",
        "\u7ea2\u516d\u519b\u56e2\u8def\u7ebf\u56fe": "route_hongliu_juntuan",
        "\u7ea2\u4e03\u519b\u56e2\u8def\u7ebf\u56fe": "route_hongqi_juntuan",
        "\u7ea2\u5341\u516b\u5e08\u8def\u7ebf\u56fe": "route_hongshiba_shi",
        "\u7ea2\u4e09\u5341\u519b\u8def\u7ebf\u56fe": "route_hongsanshi_jun",
        "\u7ea2\u4e8c\u5341\u4e94\u519b\u8def\u7ebf\u56fe": "route_hongershiwu_jun",
    }

    return mapping.get(name, name)


def make_feature_collection(records, geometries):
    features = []

    for index, properties in enumerate(records):
        geometry = geometries[index] if index < len(geometries) else None
        features.append(
            {
                "type": "Feature",
                "properties": properties,
                "geometry": geometry,
            }
        )

    return {
        "type": "FeatureCollection",
        "features": features,
    }


def sort_route_features(features):
    def order_value(feature):
        value = feature["properties"].get("_order")

        if value is None:
            return 999999

        return value

    return sorted(features, key=order_value)


def sort_event_features(features):
    def event_value(feature):
        properties = feature["properties"]

        return (
            properties.get("\u4e8b\u4ef6\u65e5", ""),
            properties.get("\u4e8b\u4ef6\u7f16", 0) or 0,
        )

    return sorted(features, key=event_value)


def generate_routes():
    os.makedirs(ROUTE_OUTPUT_DIR, exist_ok=True)
    layer_configs = []

    shp_names = [
        name
        for name in os.listdir(ROUTE_SOURCE_DIR)
        if name.lower().endswith(".shp") and ".gis." not in name.lower()
    ]

    for index, shp_name in enumerate(sorted(shp_names)):
        base_name = os.path.splitext(shp_name)[0]
        layer_key = slugify_route_name(base_name)
        shp_path = os.path.join(ROUTE_SOURCE_DIR, shp_name)
        dbf_path = os.path.splitext(shp_path)[0] + ".dbf"
        dbf_data = read_dbf(dbf_path)
        shp_data = read_shp(shp_path)
        collection = make_feature_collection(dbf_data["records"], shp_data["geometries"])
        collection["features"] = sort_route_features(collection["features"])

        output_path = os.path.join(ROUTE_OUTPUT_DIR, "{}.json".format(layer_key))

        with open(output_path, "w", encoding="utf-8") as file:
            json.dump(collection, file, ensure_ascii=False, indent=2)

        layer_configs.append(
            {
                "id": index + 1,
                "layer_key": layer_key,
                "layer_name": base_name,
                "table_name": layer_key,
                "source_file": shp_name,
                "color": ROUTE_COLORS[index % len(ROUTE_COLORS)],
                "line_width": 4 if index == 0 else 3,
                "default_visible": index < 6,
                "display_order": index + 1,
                "fields": [field["name"] for field in dbf_data["fields"]],
            }
        )

    layer_configs.sort(key=lambda item: item["display_order"])

    with open(os.path.join(DATA_DIR, "route-layer-config.json"), "w", encoding="utf-8") as file:
        json.dump(layer_configs, file, ensure_ascii=False, indent=2)


def generate_events():
    shp_path = os.path.join(EVENT_SOURCE_DIR, "\u91cd\u8981\u4e8b\u4ef6\u70b9.shp")
    dbf_path = os.path.join(EVENT_SOURCE_DIR, "\u91cd\u8981\u4e8b\u4ef6\u70b9.dbf")
    dbf_data = read_dbf(dbf_path)
    shp_data = read_shp(shp_path)
    collection = make_feature_collection(dbf_data["records"], shp_data["geometries"])
    collection["features"] = sort_event_features(collection["features"])

    with open(os.path.join(DATA_DIR, "events-important.json"), "w", encoding="utf-8") as file:
        json.dump(collection, file, ensure_ascii=False, indent=2)


def main():
    generate_routes()
    generate_events()


if __name__ == "__main__":
    main()
