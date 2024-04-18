import { UploadState } from '$lib/models/upload-asset';
import { uploadAssetsStore } from '$lib/stores/upload';
import { getKey, uploadRequest } from '$lib/utils';
import { addAssetsToAlbum } from '$lib/utils/asset-utils';
import { ExecutorQueue } from '$lib/utils/executor-queue';
import { defaults, getSupportedMediaTypes, type AssetFileUploadResponseDto } from '@immich/sdk';
import { getServerErrorMessage, handleError } from './handle-error';

let _extensions: string[];

export const uploadExecutionQueue = new ExecutorQueue({ concurrency: 2 });

const getExtensions = async () => {
  if (!_extensions) {
    const { image, video } = await getSupportedMediaTypes();
    _extensions = [...image, ...video];
  }
  return _extensions;
};
// the following set of interfaces ensure that either albumId OR assetId
// may be specified, but not both.
interface FileUploadParams {
  multiple?: boolean;
}
interface FileUploadWithAlbum extends FileUploadParams {
  albumId?: string;
  assetId?: never;
}
interface FileUploadWithAsset extends FileUploadParams {
  albumId?: never;
  assetId?: string;
}
type FileUploadParam = FileUploadWithAlbum | FileUploadWithAsset;
const defaultParams: FileUploadWithAlbum = {
  multiple: true,
};

export const openFileUploadDialog = async ({ albumId, multiple, assetId }: FileUploadParam = defaultParams) => {
  const extensions = await getExtensions();

  return new Promise<(string | undefined)[]>((resolve, reject) => {
    try {
      const fileSelector = document.createElement('input');
      fileSelector.type = 'file';
      fileSelector.multiple = !!multiple;
      fileSelector.accept = extensions.join(',');
      fileSelector.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (!target.files) {
          return;
        }
        const files = Array.from(target.files);

        resolve(fileUploadHandler(files, albumId, assetId));
      });

      fileSelector.click();
    } catch (error) {
      console.log('Error selecting file', error);
      reject(error);
    }
  });
};

export const fileUploadHandler = async (files: File[], albumId?: string, assetId?: string): Promise<string[]> => {
  const extensions = await getExtensions();
  const promises = [];
  for (const file of files) {
    const name = file.name.toLowerCase();
    if (extensions.some((extension) => name.endsWith(extension))) {
      uploadAssetsStore.addNewUploadAsset({ id: getDeviceAssetId(file), file, albumId, assetId });
      promises.push(uploadExecutionQueue.addTask(() => fileUploader(file, albumId, assetId)));
    }
  }

  const results = await Promise.all(promises);
  return results.filter((result): result is string => !!result);
};

function getDeviceAssetId(asset: File) {
  return 'web' + '-' + asset.name + '-' + asset.lastModified;
}

// TODO: should probably use the @api SDK
async function fileUploader(asset: File, albumId?: string, assetId?: string): Promise<string | undefined> {
  const fileCreatedAt = new Date(asset.lastModified).toISOString();
  const deviceAssetId = getDeviceAssetId(asset);

  return new Promise((resolve) => resolve(uploadAssetsStore.markStarted(deviceAssetId)))
    .then(() => {
      const formData = new FormData();
      for (const [key, value] of Object.entries({
        deviceAssetId,
        deviceId: 'WEB',
        fileCreatedAt,
        fileModifiedAt: new Date(asset.lastModified).toISOString(),
        isFavorite: 'false',
        duration: '0:00:00.000000',
        assetData: new File([asset], asset.name),
      })) {
        formData.append(key, value);
      }

      const key = getKey();

      if (assetId) {
        return uploadRequest<AssetFileUploadResponseDto>({
          url: defaults.baseUrl + '/asset/' + assetId + '/upload' + (key ? `?key=${key}` : ''),
          method: 'PUT',
          data: formData,
          onUploadProgress: (event) => uploadAssetsStore.updateProgress(deviceAssetId, event.loaded, event.total),
        });
      }
      return uploadRequest<AssetFileUploadResponseDto>({
        url: defaults.baseUrl + '/asset/upload' + (key ? `?key=${key}` : ''),
        data: formData,
        onUploadProgress: (event) => uploadAssetsStore.updateProgress(deviceAssetId, event.loaded, event.total),
      });
    })
    .then(async (response) => {
      if (response.status == 200 || response.status == 201) {
        const res: AssetFileUploadResponseDto = response.data;

        if (res.duplicate) {
          uploadAssetsStore.duplicateCounter.update((count) => count + 1);
        } else {
          uploadAssetsStore.successCounter.update((c) => c + 1);
        }

        if (albumId && res.id) {
          uploadAssetsStore.updateAsset(deviceAssetId, { message: 'Adding to album...' });
          await addAssetsToAlbum(albumId, [res.id]);
          uploadAssetsStore.updateAsset(deviceAssetId, { message: 'Added to album' });
        }

        uploadAssetsStore.updateAsset(deviceAssetId, {
          state: res.duplicate ? UploadState.DUPLICATED : UploadState.DONE,
        });

        setTimeout(() => {
          uploadAssetsStore.removeUploadAsset(deviceAssetId);
        }, 1000);

        return res.id;
      }
    })
    .catch((error) => {
      handleError(error, 'Unable to upload file');
      const reason = getServerErrorMessage(error) || error;
      uploadAssetsStore.updateAsset(deviceAssetId, { state: UploadState.ERROR, error: reason });
      return undefined;
    });
}
