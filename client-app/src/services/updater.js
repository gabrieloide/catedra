import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

export const CURRENT_APP_VERSION = '1.0.0';
export const GITHUB_REPO = 'gabrieloide/catedra';

export async function checkAndUpdateFromGitHub(onStatusChange = () => {}) {
  try {
    onStatusChange('Buscando actualizaciones en GitHub...');
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });

    if (!response.ok) {
      onStatusChange('No se encontraron releases en GitHub.');
      return { hasUpdate: false };
    }

    const release = await response.json();
    const latestTag = release.tag_name ? release.tag_name.replace(/^v/, '') : '';
    const currentClean = CURRENT_APP_VERSION.replace(/^v/, '');

    console.log(`[Updater] Version actual: ${currentClean}, Ultima en GitHub: ${latestTag}`);

    if (!latestTag || latestTag === currentClean) {
      onStatusChange('Catedra esta en la version mas reciente.');
      return { hasUpdate: false, currentVersion: CURRENT_APP_VERSION };
    }

    // Buscar el archivo dist.zip en los assets del release
    const zipAsset = (release.assets || []).find((a) => a.name === 'dist.zip');
    if (!zipAsset) {
      onStatusChange('Nueva version encontrada pero sin paquete dist.zip adjunto.');
      return { hasUpdate: false, latestTag };
    }

    onStatusChange(`Nueva version detectada: v${latestTag}.`);

    // Si se ejecuta en Android / iOS nativo con Capacitor
    if (Capacitor.isNativePlatform()) {
      onStatusChange(`Descargando actualizacion v${latestTag}...`);
      const bundle = await CapacitorUpdater.download({
        url: zipAsset.browser_download_url,
        version: latestTag,
      });

      onStatusChange('Instalando actualizacion OTA...');
      await CapacitorUpdater.set(bundle);
      onStatusChange('Actualizacion completada. Reiniciando aplicacion...');
      await CapacitorUpdater.reload();
      return { hasUpdate: true, updated: true, newVersion: latestTag };
    }

    // Si es navegador web o PC
    return {
      hasUpdate: true,
      updated: false,
      newVersion: latestTag,
      downloadUrl: zipAsset.browser_download_url,
      releaseNotes: release.body || '',
    };
  } catch (err) {
    console.error('[Updater Error]', err);
    onStatusChange('Error al verificar actualizaciones.');
    return { hasUpdate: false, error: err.message };
  }
}
