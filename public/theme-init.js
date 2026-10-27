// Đặt giao diện trước khi React chạy để không nháy trắng khi người dùng chọn tối.
// File riêng (không inline) để giữ Content-Security-Policy script-src 'self'.
(function () {
  try {
    var pref = JSON.parse(localStorage.getItem('linko:theme-v2') || '"light"');
    var dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    var lang = JSON.parse(localStorage.getItem('linko:lang') || '"vi"');
    document.documentElement.setAttribute('lang', lang === 'en' ? 'en' : 'vi');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
