(function() {
  var themeId = localStorage.getItem('theme-id') || 'ocean-blue';
  var wallpaperId = localStorage.getItem('wallpaper-id') || 'car.png';
  
  var themeBgs: Record<string, string> = {
    'default-dark': '#000000',
    'ocean-blue': '#090e1a'
  };
  var rootBg = themeBgs[themeId] || '#090e1a';

  // Set background color instantly on document element
  document.documentElement.style.backgroundColor = rootBg;

  var style = document.createElement('style');
  var css = 'html, body { background: ' + rootBg + ' !important; margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }';
  
  if (wallpaperId && wallpaperId !== 'none') {
    var resolvedUrl = '';
    if (wallpaperId === 'custom') {
      var chromeAny = typeof chrome !== 'undefined' ? chrome : null;
      if (chromeAny && chromeAny.storage && chromeAny.storage.local) {
        chromeAny.storage.local.get(['custom-wallpaper-base64'], function(result) {
          var base64 = result['custom-wallpaper-base64'];
          if (base64) {
            var customStyle = document.createElement('style');
            customStyle.innerHTML = '#app-container::before { background-image: url("' + base64 + '") !important; }';
            document.head.appendChild(customStyle);
          }
        });
      }
    } else {
      var chromeAny = typeof chrome !== 'undefined' ? chrome : null;
      resolvedUrl = chromeAny && chromeAny.runtime && chromeAny.runtime.getURL 
        ? chromeAny.runtime.getURL('new-tab/images/wallappear/' + wallpaperId)
        : '/new-tab/images/wallappear/' + wallpaperId;
    }
    
    css += ' #app-container {' +
           '   position: relative;' +
           '   width: 100%;' +
           '   height: 100%;' +
           ' }';
    if (resolvedUrl) {
      css += ' #app-container::before {' +
             '   content: "";' +
             '   position: absolute;' +
             '   inset: 0;' +
             '   z-index: -9999;' +
             '   background-image: url("' + resolvedUrl + '");' +
             '   background-size: cover;' +
             '   background-position: center;' +
             '   background-repeat: no-repeat;' +
             '   opacity: 1.0;' +
             '   pointer-events: none;' +
             ' }';
    }
  }
  style.innerHTML = css;
  document.head.appendChild(style);
})();
