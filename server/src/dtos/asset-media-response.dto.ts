import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { Optional } from 'src/validation';

export enum GetAssetThumbnailFormatEnum {
  JPEG = 'JPEG',
  WEBP = 'WEBP',
}
export class GetAssetThumbnailDto {
  @IsOptional()
  @IsEnum(GetAssetThumbnailFormatEnum)
  @ApiProperty({
    type: String,
    enum: GetAssetThumbnailFormatEnum,
    default: GetAssetThumbnailFormatEnum.WEBP,
    required: false,
    enumName: 'ThumbnailFormat',
  })
  format: GetAssetThumbnailFormatEnum = GetAssetThumbnailFormatEnum.WEBP;
}

export enum AssetMediaStatusEnum {
  CREATED = 'created',
  REPLACED = 'replaced',
  DUPLICATE = 'duplicate',
}
export class AssetMediaResponseDto {
  @ApiProperty({
    type: String,
    enum: AssetMediaStatusEnum,
    required: true,
    enumName: 'AssetMediaStatus',
  })
  status?: AssetMediaStatusEnum;
  @IsOptional()
  id?: string;
}

export enum AssetUploadAction {
  ACCEPT = 'accept',
  REJECT = 'reject',
}

export enum AssetRejectReason {
  DUPLICATE = 'duplicate',
  UNSUPPORTED_FORMAT = 'unsupported-format',
}

export class AssetBulkUploadCheckResult {
  id!: string;
  action!: AssetUploadAction;
  reason?: AssetRejectReason;
  assetId?: string;
}

export class AssetBulkUploadCheckResponseDto {
  results!: AssetBulkUploadCheckResult[];
}
export class CheckExistingAssetsResponseDto {
  existingIds!: string[];
}
