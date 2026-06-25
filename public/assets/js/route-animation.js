(function () {
  function distance(left, right) {
    const latGap = left[0] - right[0];
    const lngGap = left[1] - right[1];

    return Math.sqrt(latGap * latGap + lngGap * lngGap);
  }

  class RouteAnimator {
    constructor(map, route, options = {}) {
      this.map = map;
      this.route = route;
      this.duration = options.duration || 22000;
      this.speed = 1;
      this.onProgress = options.onProgress || (() => {});
      this.onComplete = options.onComplete || (() => {});

      this.progress = 0;
      this.elapsed = 0;
      this.startedAt = 0;
      this.frameId = 0;
      this.playing = false;
      this.measure = this.measureRoute(route.points);

      this.layerGroup = L.layerGroup().addTo(map);

      this.trailGlow = L.polyline([], {
        color: "#f4c95d",
        weight: 10,
        opacity: 0.28,
        lineCap: "round",
        interactive: false,
      }).addTo(this.layerGroup);

      this.trail = L.polyline([], {
        color: route.color,
        weight: route.weight || 5,
        opacity: 0.98,
        lineCap: "round",
        lineJoin: "round",
        className: "animated-route",
        interactive: false,
      }).addTo(this.layerGroup);

      this.head = L.marker(route.points[0], {
        icon: L.divIcon({
          className: "march-head-icon",
          html: '<span class="march-head"><b>★</b><i></i></span>',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        }),
        zIndexOffset: 1600,
        interactive: false,
      }).addTo(this.layerGroup);

      this.tick = this.tick.bind(this);
      this.render(0);
    }

    measureRoute(points) {
      const cumulative = [0];
      let total = 0;

      for (let index = 1; index < points.length; index += 1) {
        total += distance(points[index - 1], points[index]);
        cumulative.push(total);
      }

      return {
        total: total || 1,
        cumulative,
      };
    }

    getCurrentSegment(pointIndex) {
      const segments = this.route.segments || [];

      return segments.find((segment) => {
        return pointIndex >= segment.startIndex && pointIndex <= segment.endIndex;
      });
    }

    sample(progress) {
      const target = progress * this.measure.total;
      const points = this.route.points;
      let index = 0;

      while (
        index < this.measure.cumulative.length - 2 &&
        this.measure.cumulative[index + 1] < target
      ) {
        index += 1;
      }

      const startDistance = this.measure.cumulative[index];
      const endDistance = this.measure.cumulative[index + 1] || startDistance;
      const ratio =
        endDistance === startDistance
          ? 0
          : (target - startDistance) / (endDistance - startDistance);
      const start = points[index];
      const end = points[index + 1] || start;

      return {
        index,
        point: [
          start[0] + (end[0] - start[0]) * ratio,
          start[1] + (end[1] - start[1]) * ratio,
        ],
        segment: this.getCurrentSegment(index),
      };
    }

    render(progress) {
      this.progress = Math.max(0, Math.min(1, progress));

      const sample = this.sample(this.progress);
      const completed = this.route.points.slice(0, sample.index + 1);
      completed.push(sample.point);

      this.trailGlow.setLatLngs(completed);
      this.trail.setLatLngs(completed);
      this.head.setLatLng(sample.point);

      this.onProgress({
        progress: this.progress,
        point: sample.point,
        segment: sample.segment,
        route: this.route,
      });
    }

    tick(now) {
      if (!this.playing) {
        return;
      }

      if (!this.startedAt) {
        this.startedAt = now - this.elapsed / this.speed;
      }

      this.elapsed = (now - this.startedAt) * this.speed;
      this.render(this.elapsed / this.duration);

      if (this.elapsed < this.duration) {
        this.frameId = requestAnimationFrame(this.tick);
        return;
      }

      this.playing = false;
      cancelAnimationFrame(this.frameId);
      this.onComplete(this.route);
    }

    play() {
      if (this.playing) {
        return;
      }

      if (this.progress >= 1) {
        this.elapsed = 0;
        this.progress = 0;
      }

      this.playing = true;
      this.startedAt = 0;
      this.frameId = requestAnimationFrame(this.tick);
    }

    pause() {
      this.playing = false;
      cancelAnimationFrame(this.frameId);
    }

    reset() {
      this.pause();
      this.elapsed = 0;
      this.startedAt = 0;
      this.render(0);
    }

    seek(progress) {
      this.progress = Math.max(0, Math.min(1, progress));
      this.elapsed = this.progress * this.duration;

      if (this.playing) {
        this.startedAt = performance.now() - this.elapsed / this.speed;
      }

      this.render(this.progress);
    }

    setSpeed(speed) {
      const nextSpeed = Number(speed) || 1;

      if (this.playing) {
        this.startedAt = performance.now() - this.elapsed / nextSpeed;
      }

      this.speed = nextSpeed;
    }

    remove() {
      this.pause();
      this.map.removeLayer(this.layerGroup);
    }
  }

  window.RouteAnimator = RouteAnimator;
})();
