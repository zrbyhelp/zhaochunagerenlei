(function () {
  try {
    var key = "human-hunt-theme";
    var raw = window.localStorage.getItem(key);
    var saved = raw ? JSON.parse(raw) : {};
    var mode = saved.mode || "dark";
    var palette = saved.palette || "star-map";
    var density = saved.density || "normal";
    var typeScale = saved.typeScale || "normal";
    var root = document.documentElement;

    root.dataset.themeMode = mode;
    root.dataset.palette = palette;
    root.dataset.density = density;
    root.dataset.typeScale = typeScale;
  } catch {
    document.documentElement.dataset.themeMode = "dark";
    document.documentElement.dataset.palette = "star-map";
    document.documentElement.dataset.density = "normal";
    document.documentElement.dataset.typeScale = "normal";
  }
})();
