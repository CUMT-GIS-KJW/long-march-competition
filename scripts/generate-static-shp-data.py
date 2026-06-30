import json
import os
import struct
import sys


ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PROJECT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_ROOT = os.path.join(PROJECT_DIR, "data")
JSON_DATA_DIR = os.path.join(DATA_ROOT, "json")
ROUTE_DATA_DIR = os.path.join(DATA_ROOT, "routes")
DESKTOP_DIR = os.path.abspath(os.path.join(ROOT_DIR, ".."))
ROUTE_SOURCE_CANDIDATES = [
    os.environ.get("ROUTE_SOURCE_DIR", ""),
    os.path.join(DESKTOP_DIR, "\u8def\u7ebf\u6570\u636e", "\u8def\u7ebf\u6570\u636e"),
    os.path.join(DESKTOP_DIR, "\u8def\u7ebf\u6570\u636e"),
    os.path.join(ROOT_DIR, "\u8def\u7ebf\u6570\u636e", "\u8def\u7ebf\u6570\u636e"),
    os.path.join(ROOT_DIR, "\u8def\u7ebf\u6570\u636e"),
]
ZHONGYANG_ROUTE_KEY = "route_zhongyang_zongdui"
HONGYI_ROUTE_KEY = "route_hongyi_juntuan"
ZHONGYANG_CORRECT_ROUTE_CANDIDATES = [
    os.environ.get("ZHONGYANG_ROUTE_SOURCE_DIR", ""),
    os.path.join(DESKTOP_DIR, "\u8def\u7ebf\u6570\u636e", "\u6b63\u786e\u8def\u7ebf"),
    os.path.join(ROOT_DIR, "\u8def\u7ebf\u6570\u636e", "\u6b63\u786e\u8def\u7ebf"),
]
HONGYI_CORRECT_ROUTE_CANDIDATES = [
    os.environ.get("HONGYI_ROUTE_SOURCE_DIR", ""),
    os.path.join(DESKTOP_DIR, "\u8def\u7ebf\u6570\u636e", "\u6b63\u786e\u8def\u7ebf"),
    os.path.join(ROOT_DIR, "\u8def\u7ebf\u6570\u636e", "\u6b63\u786e\u8def\u7ebf"),
]
CORRECT_ROUTE_CANDIDATES = [
    os.environ.get("CORRECT_ROUTE_SOURCE_DIR", ""),
    os.path.join(DESKTOP_DIR, "\u8def\u7ebf\u6570\u636e", "\u6b63\u786e\u8def\u7ebf"),
    os.path.join(ROOT_DIR, "\u8def\u7ebf\u6570\u636e", "\u6b63\u786e\u8def\u7ebf"),
]
EVENT_SOURCE_DIR = os.path.join(ROOT_DIR, "\u91cd\u8981\u4e8b\u4ef6\u70b9")
ROUTE_OUTPUT_DIR = os.path.join(ROUTE_DATA_DIR, "route-layers")


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

ROUTE_DISPLAY_ORDER = [
    "route_zhongyang_zongdui",
    "route_hongyi_juntuan",
    "route_hongqi_juntuan",
    "route_hongsan_juntuan",
    "route_hongsanshi_jun",
    "route_hongjiu_juntuan",
    "route_honger_juntuan",
    "route_hongershiwu_jun",
    "route_hongwu_juntuan",
    "route_hongliu_juntuan",
    "route_hongshiba_shi",
    "route_hongsi_juntuan",
]

CORRECT_ROUTE_SPECS = [
    {
        "route_key": "route_zhongyang_zongdui",
        "prefix": "\u4e2d\u592e\u7eb5\u961f\u8def\u7ebf\u56fe",
        "source_file": "\u6b63\u786e\u8def\u7ebf/\u4e2d\u592e\u7eb5\u961f\u8def\u7ebf\u56fe_01-07.shp",
        "default_corps_name": "\u4e2d\u592e\u7eb5\u961f",
        "default_stage_name": "\u4e2d\u592e\u7eb5\u961f\u8def\u7ebf",
    },
    {
        "route_key": "route_hongyi_juntuan",
        "prefix": "\u7ea2\u4e00\u65b9\u9762\u519b\u957f\u5f81\u8def\u7ebf",
        "source_file": "\u6b63\u786e\u8def\u7ebf/\u7ea2\u4e00\u65b9\u9762\u519b\u957f\u5f81\u8def\u7ebf_01-10.shp",
        "default_corps_name": "\u7ea2\u4e00\u65b9\u9762\u519b",
        "default_stage_name": "\u7ea2\u4e00\u65b9\u9762\u519b\u8def\u7ebf",
    },
    {
        "route_key": "route_hongqi_juntuan",
        "prefix": "\u7ea2\u4e03\u519b\u56e2\u8def\u7ebf\u56fe",
        "source_file": "\u6b63\u786e\u8def\u7ebf/\u7ea2\u4e03\u519b\u56e2\u8def\u7ebf\u56fe01-03.shp",
        "default_corps_name": "\u7ea2\u4e03\u519b\u56e2",
        "default_stage_name": "\u7ea2\u4e03\u519b\u56e2\u8def\u7ebf",
    },
    {
        "route_key": "route_hongsan_juntuan",
        "prefix": "\u7ea2\u4e09\u519b\u56e2\u8def\u7ebf\u56fe",
        "source_file": "\u6b63\u786e\u8def\u7ebf/\u7ea2\u4e09\u519b\u56e2\u8def\u7ebf\u56fe_01-09.shp",
        "default_corps_name": "\u7ea2\u4e09\u519b\u56e2",
        "default_stage_name": "\u7ea2\u4e09\u519b\u56e2\u8def\u7ebf",
    },
    {
        "route_key": "route_hongjiu_juntuan",
        "prefix": "\u7ea2\u4e5d\u519b\u56e2\u8def\u7ebf\u56fe",
        "source_file": "\u6b63\u786e\u8def\u7ebf/\u7ea2\u4e5d\u519b\u56e2\u8def\u7ebf\u56fe_01-07.shp",
        "default_corps_name": "\u7ea2\u4e5d\u519b\u56e2",
        "default_stage_name": "\u7ea2\u4e5d\u519b\u56e2\u8def\u7ebf",
    },
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


def date_sort_value(value):
    text = str(value or "")

    if len(text) == 10 and text[4] == "-" and text[7] == "-":
        return text

    if len(text) == 8 and text.isdigit():
        return "{}-{}-{}".format(text[0:4], text[4:6], text[6:8])

    return "9999-99-99"


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


def make_route_feature_collection(records, geometries):
    features = []

    for source_index, properties in enumerate(records):
        geometry = geometries[source_index] if source_index < len(geometries) else None

        if not geometry:
            continue

        props = dict(properties)
        props["_source_order"] = props.get("_order")
        props["_source_index"] = source_index + 1

        if props.get("descript") is None and props.get("descriptio") is not None:
            props["descript"] = props.get("descriptio")

        lines = (
            geometry.get("coordinates", [])
            if geometry.get("type") == "MultiLineString"
            else [geometry.get("coordinates", [])]
        )

        for part_index, line in enumerate(lines, start=1):
            if not line:
                continue

            part_props = dict(props)
            part_props["_part_index"] = part_index
            part_props["_source_geometry"] = geometry.get("type")
            features.append(
                {
                    "type": "Feature",
                    "properties": part_props,
                    "geometry": {
                        "type": "LineString",
                        "coordinates": line,
                    },
                }
            )

    features = sort_route_features_by_time(features)

    for order, feature in enumerate(features, start=1):
        feature["properties"]["_order"] = order

    return {
        "type": "FeatureCollection",
        "features": features,
    }


def make_ordered_route_feature_collection(shp_items, default_corps_name, default_stage_name):
    features = []
    fields = []

    for file_order, shp_name, dbf_data, geometries in shp_items:
        for field in dbf_data["fields"]:
            if field["name"] not in fields:
                fields.append(field["name"])

        for source_index, properties in enumerate(dbf_data["records"]):
            geometry = geometries[source_index] if source_index < len(geometries) else None

            if not geometry:
                continue

            props = dict(properties)
            props["_source_order"] = props.get("_order")
            props["_source_file_order"] = file_order
            props["_source_file"] = shp_name
            props["_source_index"] = source_index + 1
            props["corps_name"] = props.get("corps_name") or default_corps_name
            props["stage_name"] = props.get("stage_name") or props.get("KML_FOLDER") or default_stage_name

            if props.get("descript") is None and props.get("descriptio") is not None:
                props["descript"] = props.get("descriptio")

            lines = (
                geometry.get("coordinates", [])
                if geometry.get("type") == "MultiLineString"
                else [geometry.get("coordinates", [])]
            )

            for part_index, line in enumerate(lines, start=1):
                if not line:
                    continue

                part_props = dict(props)
                part_props["_order"] = file_order
                part_props["_part_index"] = part_index
                part_props["_source_geometry"] = geometry.get("type")
                features.append(
                    {
                        "type": "Feature",
                        "properties": part_props,
                        "geometry": {
                            "type": "LineString",
                            "coordinates": line,
                        },
                    }
                )

    return {
        "collection": {
            "type": "FeatureCollection",
            "features": features,
        },
        "fields": fields,
    }


def sort_route_features_by_time(features):
    def order_value(feature):
        properties = feature["properties"]

        return (
            date_sort_value(properties.get("start_date")),
            date_sort_value(properties.get("end_date")),
            properties.get("_source_order") or 999999,
            properties.get("_source_index") or 999999,
            properties.get("_part_index") or 999999,
        )

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
    os.makedirs(JSON_DATA_DIR, exist_ok=True)
    route_source_dir = resolve_route_source_dir()
    zhongyang_correct_dir = resolve_zhongyang_correct_route_dir()
    hongyi_correct_dir = resolve_hongyi_correct_route_dir()
    existing_configs = load_existing_route_configs()
    layer_configs = []

    for name in os.listdir(ROUTE_OUTPUT_DIR):
        if name.lower().endswith(".json"):
            os.remove(os.path.join(ROUTE_OUTPUT_DIR, name))

    shp_names = [
        name
        for name in os.listdir(route_source_dir)
        if name.lower().endswith(".shp") and ".gis." not in name.lower()
    ]

    shp_names.sort(key=lambda name: route_display_order(slugify_route_name(os.path.splitext(name)[0])))

    for index, shp_name in enumerate(shp_names):
        base_name = os.path.splitext(shp_name)[0]
        layer_key = slugify_route_name(base_name)
        existing_config = existing_configs.get(layer_key, {})
        shp_path = os.path.join(route_source_dir, shp_name)
        dbf_path = os.path.splitext(shp_path)[0] + ".dbf"
        dbf_data = read_dbf(dbf_path)
        shp_data = read_shp(shp_path)
        fields = [field["name"] for field in dbf_data["fields"]]
        source_file = shp_name

        if layer_key == ZHONGYANG_ROUTE_KEY and zhongyang_correct_dir:
            correct_route = read_ordered_correct_route(
                zhongyang_correct_dir,
                "\u4e2d\u592e\u7eb5\u961f\u8def\u7ebf\u56fe_",
                "\u4e2d\u592e\u7eb5\u961f",
                "\u4e2d\u592e\u7eb5\u961f\u8def\u7ebf",
                "Zhongyang correct route Shapefile source directory not found",
            )
            collection = correct_route["collection"]
            fields = correct_route["fields"]
            source_file = "\u6b63\u786e\u8def\u7ebf/\u4e2d\u592e\u7eb5\u961f\u8def\u7ebf\u56fe_01-07.shp"
        elif layer_key == HONGYI_ROUTE_KEY and hongyi_correct_dir:
            correct_route = read_ordered_correct_route(
                hongyi_correct_dir,
                "\u7ea2\u4e00\u65b9\u9762\u519b\u957f\u5f81\u8def\u7ebf_",
                "\u7ea2\u4e00\u65b9\u9762\u519b",
                "\u7ea2\u4e00\u65b9\u9762\u519b\u8def\u7ebf",
                "Hongyi correct route Shapefile source directory not found",
            )
            collection = correct_route["collection"]
            fields = correct_route["fields"]
            source_file = "\u6b63\u786e\u8def\u7ebf/\u7ea2\u4e00\u65b9\u9762\u519b\u957f\u5f81\u8def\u7ebf_01-10.shp"
        else:
            collection = make_route_feature_collection(dbf_data["records"], shp_data["geometries"])

        output_path = os.path.join(ROUTE_OUTPUT_DIR, "{}.json".format(layer_key))

        with open(output_path, "w", encoding="utf-8") as file:
            json.dump(collection, file, ensure_ascii=False, indent=2)

        layer_configs.append(
            {
                "id": existing_config.get("id", index + 1),
                "layer_key": layer_key,
                "layer_name": base_name,
                "table_name": layer_key,
                "source_file": source_file,
                "color": existing_config.get("color", ROUTE_COLORS[index % len(ROUTE_COLORS)]),
                "line_width": existing_config.get("line_width", 4 if index == 0 else 3),
                "default_visible": existing_config.get("default_visible", index < 6),
                "display_order": existing_config.get("display_order", route_display_order(layer_key)),
                "fields": fields,
            }
        )

    layer_configs.sort(key=lambda item: item["display_order"])

    with open(os.path.join(ROUTE_DATA_DIR, "route-layer-config.json"), "w", encoding="utf-8") as file:
        json.dump(layer_configs, file, ensure_ascii=False, indent=2)


def generate_zhongyang_route_only():
    correct_route = read_ordered_correct_route(
        resolve_zhongyang_correct_route_dir(),
        "\u4e2d\u592e\u7eb5\u961f\u8def\u7ebf\u56fe_",
        "\u4e2d\u592e\u7eb5\u961f",
        "\u4e2d\u592e\u7eb5\u961f\u8def\u7ebf",
        "Zhongyang correct route Shapefile source directory not found",
    )

    write_single_route(
        ZHONGYANG_ROUTE_KEY,
        "\u6b63\u786e\u8def\u7ebf/\u4e2d\u592e\u7eb5\u961f\u8def\u7ebf\u56fe_01-07.shp",
        correct_route,
    )


def generate_hongyi_route_only():
    correct_route = read_ordered_correct_route(
        resolve_hongyi_correct_route_dir(),
        "\u7ea2\u4e00\u65b9\u9762\u519b\u957f\u5f81\u8def\u7ebf_",
        "\u7ea2\u4e00\u65b9\u9762\u519b",
        "\u7ea2\u4e00\u65b9\u9762\u519b\u8def\u7ebf",
        "Hongyi correct route Shapefile source directory not found",
    )

    write_single_route(
        HONGYI_ROUTE_KEY,
        "\u6b63\u786e\u8def\u7ebf/\u7ea2\u4e00\u65b9\u9762\u519b\u957f\u5f81\u8def\u7ebf_01-10.shp",
        correct_route,
    )


def generate_correct_routes_only():
    correct_route_dir = resolve_correct_route_dir()

    if not correct_route_dir:
        raise FileNotFoundError("Correct route Shapefile source directory not found")

    for spec in CORRECT_ROUTE_SPECS:
        if not has_ordered_route_files(correct_route_dir, spec["prefix"]):
            continue

        correct_route = read_ordered_correct_route(
            correct_route_dir,
            spec["prefix"],
            spec["default_corps_name"],
            spec["default_stage_name"],
            "Correct route Shapefile source files not found: {}".format(spec["prefix"]),
        )
        write_single_route(spec["route_key"], spec["source_file"], correct_route)


def write_single_route(route_key, source_file, route_data):
    os.makedirs(ROUTE_OUTPUT_DIR, exist_ok=True)
    output_path = os.path.join(ROUTE_OUTPUT_DIR, "{}.json".format(route_key))

    with open(output_path, "w", encoding="utf-8") as file:
        json.dump(route_data["collection"], file, ensure_ascii=False, indent=2)

    config_path = os.path.join(ROUTE_DATA_DIR, "route-layer-config.json")

    if not os.path.exists(config_path):
        return

    with open(config_path, "r", encoding="utf-8") as file:
        configs = json.load(file)

    for item in configs:
        if item.get("layer_key") != route_key:
            continue

        item["source_file"] = source_file
        item["fields"] = route_data["fields"]
        break

    with open(config_path, "w", encoding="utf-8") as file:
        json.dump(configs, file, ensure_ascii=False, indent=2)


def resolve_route_source_dir():
    for directory in ROUTE_SOURCE_CANDIDATES:
        if not directory or not os.path.isdir(directory):
            continue

        if any(name.lower().endswith(".shp") for name in os.listdir(directory)):
            return directory

    raise FileNotFoundError("Route Shapefile source directory not found")


def resolve_zhongyang_correct_route_dir():
    for directory in ZHONGYANG_CORRECT_ROUTE_CANDIDATES:
        if not directory or not os.path.isdir(directory):
            continue

        if any(is_zhongyang_correct_route_file(name) for name in os.listdir(directory)):
            return directory

    return ""


def resolve_correct_route_dir():
    for directory in CORRECT_ROUTE_CANDIDATES:
        if not directory or not os.path.isdir(directory):
            continue

        if any(
            has_ordered_route_files(directory, spec["prefix"])
            for spec in CORRECT_ROUTE_SPECS
        ):
            return directory

    return ""


def resolve_hongyi_correct_route_dir():
    for directory in HONGYI_CORRECT_ROUTE_CANDIDATES:
        if not directory or not os.path.isdir(directory):
            continue

        if any(is_hongyi_correct_route_file(name) for name in os.listdir(directory)):
            return directory

    return ""


def is_zhongyang_correct_route_file(name):
    return name.startswith("\u4e2d\u592e\u7eb5\u961f\u8def\u7ebf\u56fe_") and name.lower().endswith(".shp")


def is_hongyi_correct_route_file(name):
    return name.startswith("\u7ea2\u4e00\u65b9\u9762\u519b\u957f\u5f81\u8def\u7ebf_") and name.lower().endswith(".shp")


def is_ordered_route_file(name, prefix):
    return name.startswith(prefix) and name.lower().endswith(".shp")


def has_ordered_route_files(directory, prefix):
    return any(
        is_ordered_route_file(name, prefix) and route_file_order(name) != 999999
        for name in os.listdir(directory)
    )


def route_file_order(name):
    base_name = os.path.splitext(name)[0]
    digits = []

    for char in reversed(base_name):
        if not char.isdigit():
            break

        digits.append(char)

    try:
        return int("".join(reversed(digits)))
    except ValueError:
        return 999999


def read_ordered_correct_route(directory, prefix, default_corps_name, default_stage_name, error_message):
    if not directory:
        raise FileNotFoundError(error_message)

    shp_names = [
        name
        for name in os.listdir(directory)
        if is_ordered_route_file(name, prefix) and route_file_order(name) != 999999
    ]
    shp_names.sort(key=route_file_order)

    if not shp_names:
        raise FileNotFoundError(error_message)

    shp_items = []

    for shp_name in shp_names:
        shp_path = os.path.join(directory, shp_name)
        dbf_path = os.path.splitext(shp_path)[0] + ".dbf"
        dbf_data = read_dbf(dbf_path)
        shp_data = read_shp(shp_path)
        shp_items.append((route_file_order(shp_name), shp_name, dbf_data, shp_data["geometries"]))

    return make_ordered_route_feature_collection(shp_items, default_corps_name, default_stage_name)


def load_existing_route_configs():
    config_path = os.path.join(ROUTE_DATA_DIR, "route-layer-config.json")

    if not os.path.exists(config_path):
        return {}

    with open(config_path, "r", encoding="utf-8") as file:
        configs = json.load(file)

    return {item.get("layer_key"): item for item in configs}


def route_display_order(layer_key):
    if layer_key in ROUTE_DISPLAY_ORDER:
        return ROUTE_DISPLAY_ORDER.index(layer_key) + 1

    return 999999


def generate_events():
    shp_path = os.path.join(EVENT_SOURCE_DIR, "\u91cd\u8981\u4e8b\u4ef6\u70b9.shp")
    dbf_path = os.path.join(EVENT_SOURCE_DIR, "\u91cd\u8981\u4e8b\u4ef6\u70b9.dbf")
    dbf_data = read_dbf(dbf_path)
    shp_data = read_shp(shp_path)
    collection = make_feature_collection(dbf_data["records"], shp_data["geometries"])
    collection["features"] = sort_event_features(collection["features"])

    with open(os.path.join(JSON_DATA_DIR, "events-important.json"), "w", encoding="utf-8") as file:
        json.dump(collection, file, ensure_ascii=False, indent=2)


def main():
    if "--zhongyang-only" in sys.argv:
        generate_zhongyang_route_only()
        return

    if "--hongyi-only" in sys.argv:
        generate_hongyi_route_only()
        return

    if "--correct-routes-only" in sys.argv:
        generate_correct_routes_only()
        return

    generate_routes()

    if "--routes-only" not in sys.argv:
        generate_events()


if __name__ == "__main__":
    main()
