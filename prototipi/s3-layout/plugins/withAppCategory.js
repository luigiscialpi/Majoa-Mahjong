const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Config Plugin Expo che inietta l'attributo android:appCategory="game"
 * nel tag <application> dell'AndroidManifest.xml.
 * 
 * Motivo tecnico (docs/decisioni-tecniche.md - sez. 5):
 * A partire da Android 16 (targetSdk 36) e Android 17, le app su grandi schermi
 * (tablet e pieghevoli >= 600 dp) ignorano i blocchi di orientamento per impostazione
 * di sistema, ad ECCEZIONE dei giochi identificati da android:appCategory="game".
 */
function setAppCategory(androidManifest) {
  if (!androidManifest || !androidManifest.application || !androidManifest.application[0]) {
    return androidManifest;
  }

  const application = androidManifest.application[0];
  application.$ = application.$ || {};
  application.$['android:appCategory'] = 'game';

  return androidManifest;
}

function withAppCategory(config) {
  return withAndroidManifest(config, (config) => {
    if (config.modResults && config.modResults.manifest) {
      setAppCategory(config.modResults.manifest);
    }
    return config;
  });
}

withAppCategory.setAppCategory = setAppCategory;

module.exports = withAppCategory;

