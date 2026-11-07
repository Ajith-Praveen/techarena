import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import type { ImageMime } from '@/api/types';

/** Server limit for decoded image bytes. */
export const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;
export const IMAGE_MAX_WIDTH = 1024;
export const IMAGE_QUALITY = 0.7;

export interface PickedImage {
  /** Local URI for previews. */
  uri: string;
  /** Base64 without the data-URL prefix (send as `imageBase64`). */
  base64: string;
  /** Send as `imageMime`. Always JPEG after compression. */
  mime: ImageMime;
  width: number;
  height: number;
  /** Decoded size in bytes. */
  sizeBytes: number;
}

export class ImagePickError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImagePickError';
  }
}

export function base64DecodedSize(b64: string): number {
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

/** Resize to at most `maxWidth` px wide and re-encode as JPEG with base64 (SPEC: 1024 px, quality 0.7). */
export async function compressImage(
  uri: string,
  maxWidth: number = IMAGE_MAX_WIDTH,
  quality: number = IMAGE_QUALITY,
): Promise<PickedImage> {
  const ctx = ImageManipulator.manipulate(uri);
  const original = await ctx.renderAsync();
  if (original.width > maxWidth) ctx.resize({ width: maxWidth });
  const ref = original.width > maxWidth ? await ctx.renderAsync() : original;
  const result = await ref.saveAsync({ compress: quality, format: SaveFormat.JPEG, base64: true });
  if (!result.base64) throw new ImagePickError('Could not process the image. Please try another one.');
  return {
    uri: result.uri,
    base64: result.base64,
    mime: 'image/jpeg',
    width: result.width,
    height: result.height,
    sizeBytes: base64DecodedSize(result.base64),
  };
}

/**
 * Lets the user pick (or take) a photo and returns it compressed per SPEC, or null if cancelled.
 * Retries with stronger compression if the result is still over the 1.5 MB server limit.
 * Throws ImagePickError with a user-friendly message on failure.
 */
export interface PickImageOptions {
  /** Square crop (profile photos). */
  square?: boolean;
  maxWidth?: number;
}

export async function pickImage(
  source: 'library' | 'camera' = 'library',
  { square = false, maxWidth = IMAGE_MAX_WIDTH }: PickImageOptions = {},
): Promise<PickedImage | null> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: square,
    ...(square ? { aspect: [1, 1] as [number, number] } : {}),
  };
  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new ImagePickError('Camera permission is needed to take a photo.');
    result = await ImagePicker.launchCameraAsync(options);
  } else {
    result = await ImagePicker.launchImageLibraryAsync(options);
  }
  if (result.canceled || !result.assets?.[0]) return null;

  const uri = result.assets[0].uri;
  try {
    let img = await compressImage(uri, maxWidth);
    if (img.sizeBytes > MAX_IMAGE_BYTES) img = await compressImage(uri, Math.min(maxWidth, 800), 0.5);
    if (img.sizeBytes > MAX_IMAGE_BYTES) throw new ImagePickError('That image is too large. Please choose a smaller one.');
    return img;
  } catch (e) {
    if (e instanceof ImagePickError) throw e;
    throw new ImagePickError('Could not read that image. Please try another one.');
  }
}

/** Profile photo per SPEC: square crop, 512 px, JPEG 0.7. */
export const PROFILE_PHOTO_SIZE = 512;

export function pickProfilePhoto(source: 'library' | 'camera' = 'library'): Promise<PickedImage | null> {
  return pickImage(source, { square: true, maxWidth: PROFILE_PHOTO_SIZE });
}

/** Shape expected by register / updateTeam bodies. */
export function toImageUpload(img: PickedImage): { imageBase64: string; imageMime: ImageMime } {
  return { imageBase64: img.base64, imageMime: img.mime };
}

/** Posters are portrait and text-heavy, so they keep more pixels than project images. */
export const POSTER_MAX_WIDTH = 1240;

export function pickPoster(source: 'library' | 'camera' = 'library'): Promise<PickedImage | null> {
  return pickImage(source, { maxWidth: POSTER_MAX_WIDTH });
}

export function toPosterUpload(img: PickedImage): { posterBase64: string; posterMime: ImageMime } {
  return { posterBase64: img.base64, posterMime: img.mime };
}
