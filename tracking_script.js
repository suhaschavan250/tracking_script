(function () {
  function getConfigFromAttributes() {
    const scripts = document.querySelectorAll('tracking_script');
    const trackingScript = Array.from(scripts).find(s => s.dataset && s.dataset.facebookPixelId);

    if (!trackingScript) {
      console.warn('[Tracking] Tracking script not found or missing data attributes.');
      return {};
    }

    const config = {
      facebookPixelId: trackingScript.dataset.facebookPixelId,
      googleAdsId: trackingScript.dataset.googleAdsId,
      scroll20ConversionId: trackingScript.dataset.scroll20Conversion,
      scroll50ConversionId: trackingScript.dataset.scroll50Conversion,
      anyClickConversionId: trackingScript.dataset.anyClickConversion,
      ctaClickConversionId: trackingScript.dataset.ctaClickConversion,
      ga4MeasurementId: trackingScript.dataset.ga4Id,
      tiktokPixelId: trackingScript.dataset.tiktokPixelId,
      ctaText: (trackingScript.dataset.ctaText || "").trim()
    };

    console.log('[Tracking] Config from data attributes:', config);
    return config;
  }

  const CONFIG = getConfigFromAttributes();
  const scrollTracked = { '20': false, '50': false };

  function pixelsReady() {
    return (
      typeof fbq === 'function' ||
      typeof gtag === 'function' ||
      typeof ttq === 'function'
    );
  }

  function getScrollPercent() {
    const doc = document.documentElement;
    const scrollTop = window.pageYOffset || doc.scrollTop;
    const scrollHeight = doc.scrollHeight - doc.clientHeight;
    return Math.round((scrollTop / scrollHeight) * 100);
  }

  function sendToAllPlatforms(eventName, data = {}) {
    console.log(`[Tracking] Event: ${eventName}`, data);

    if (typeof fbq === 'function' && CONFIG.facebookPixelId) {
      fbq('trackCustom', eventName, data);
    }

    if (typeof gtag === 'function' && CONFIG.googleAdsId) {
      let conversionId = null;
      if (eventName === 'scroll_20') conversionId = CONFIG.scroll20ConversionId;
      if (eventName === 'scroll_50') conversionId = CONFIG.scroll50ConversionId;
      if (eventName === 'any_click') conversionId = CONFIG.anyClickConversionId;
      if (eventName === 'any_cta') conversionId = CONFIG.ctaClickConversionId;

      if (conversionId) {
        gtag('event', 'conversion', { 'send_to': `${CONFIG.googleAdsId}/${conversionId}` });
      }

      if (CONFIG.ga4MeasurementId) {
        gtag('event', eventName, data);
      }
    }

    if (typeof ttq === 'function' && CONFIG.tiktokPixelId) {
      ttq.track(eventName, data);
    }
  }

  function handleScroll() {
    const percent = getScrollPercent();

    if (!scrollTracked['20'] && percent >= 20) {
      sendToAllPlatforms('scroll_20', { percent, url: window.location.href });
      scrollTracked['20'] = true;
    }

    if (!scrollTracked['50'] && percent >= 50) {
      sendToAllPlatforms('scroll_50', { percent, url: window.location.href });
      scrollTracked['50'] = true;
    }

    if (scrollTracked['20'] && scrollTracked['50']) {
      window.removeEventListener('scroll', debounceScroll);
    }
  }

  let scrollTimeout = null;
  function debounceScroll() {
    if (scrollTimeout) return;
    scrollTimeout = setTimeout(() => {
      handleScroll();
      scrollTimeout = null;
    }, 200);
  }

  function normalize(str) {
    return (str || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function handleClick(event) {
    const clickedText = (event.target.textContent || '').trim();
    const url = window.location.href;

    const clickedNormalized = normalize(clickedText);
    const expected = normalize(CONFIG.ctaText);

    console.log('[Tracking] Clicked Text:', `"${clickedText}"`);
    console.log('[Tracking] CTA Text:', `"${CONFIG.ctaText}"`);
    console.log('[Tracking] Normalized Match:', clickedNormalized === expected);

    sendToAllPlatforms('any_click', {
      url,
      text: clickedText.slice(0, 100)
    });

    if (clickedNormalized === expected) {
      sendToAllPlatforms('any_cta', {
        url,
        text: clickedText.slice(0, 50)
      });
    }
  }

  function initListeners() {
    window.addEventListener('scroll', debounceScroll, { passive: true });
    setTimeout(handleScroll, 1000);

    document.addEventListener('click', handleClick);
  }

  function startTracking() {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      initListeners();
    } else {
      window.addEventListener('DOMContentLoaded', initListeners);
    }
  }

  function waitForPixels() {
    let attempts = 0;
    const interval = setInterval(() => {
      if (pixelsReady()) {
        clearInterval(interval);
        console.log('[Tracking] Pixels detected, starting tracking.');
        startTracking();
      } else if (attempts++ >= 40) {
        clearInterval(interval);
        console.warn('[Tracking] Pixels not detected after waiting, starting anyway.');
        startTracking();
      }
    }, 500);
  }

  waitForPixels();
})();
