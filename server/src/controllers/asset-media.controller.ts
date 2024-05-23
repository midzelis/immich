import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Next,
  Param,
  ParseFilePipe,
  Post,
  Put,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiHeader, ApiTags } from '@nestjs/swagger';
import { NextFunction, Response } from 'express';
import { EndpointLifecycle } from 'src/decorators';
import {
  AssetBulkUploadCheckResponseDto,
  AssetMediaResponseDto,
  AssetMediaStatusEnum,
  CheckExistingAssetsResponseDto,
  GetAssetThumbnailDto,
} from 'src/dtos/asset-media-response.dto';
import {
  AssetBulkUploadCheckDto,
  CheckExistingAssetsDto,
  CreateAssetMediaDto,
  ServeFileDto,
  UpdateAssetMediaDto,
  UploadFieldName,
} from 'src/dtos/asset-media.dto';
import { AuthDto, ImmichHeader } from 'src/dtos/auth.dto';
import { ILoggerRepository } from 'src/interfaces/logger.interface';
import { AssetUploadInterceptor } from 'src/middleware/asset-upload.interceptor';
import { Auth, Authenticated, FileResponse } from 'src/middleware/auth.guard';
import { FileUploadInterceptor, Route, UploadFiles, getFiles } from 'src/middleware/file-upload.interceptor';
import { AssetMediaService } from 'src/services/asset-media.service';
import { sendFile } from 'src/utils/file';
import { FileNotEmptyValidator, UUIDParamDto } from 'src/validation';

@ApiTags('Asset')
@Controller(Route.ASSET)
export class AssetMediaController {
  constructor(
    @Inject(ILoggerRepository) private logger: ILoggerRepository,
    private service: AssetMediaService,
  ) {}

  /**
   * Create an asset from the binary data in the request.
   */
  @Post()
  @UseInterceptors(AssetUploadInterceptor, FileUploadInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiHeader({
    name: ImmichHeader.CHECKSUM,
    description: 'sha1 checksum that can be used for duplicate detection before the file is uploaded',
    required: false,
  })
  @ApiBody({
    type: CreateAssetMediaDto,
  })
  @Authenticated({ sharedLink: true })
  @EndpointLifecycle({ addedAt: 'v1.106.0' })
  async createAsset(
    @Auth() auth: AuthDto,
    @UploadedFiles(new ParseFilePipe({ validators: [new FileNotEmptyValidator(['assetData'])] })) files: UploadFiles,
    @Body() dto: CreateAssetMediaDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AssetMediaResponseDto> {
    const { file, sidecarFile } = getFiles(files);
    const assetMediaResponse = await this.service.createAsset(auth, dto, file, sidecarFile);
    if (assetMediaResponse.status === 'duplicate') {
      res.status(HttpStatus.OK);
    }
    return assetMediaResponse;
  }

  @Get(':id/file')
  @FileResponse()
  @Authenticated({ sharedLink: true })
  @EndpointLifecycle({ addedAt: 'v1.106.0' })
  async getOriginalBytes(
    @Res() res: Response,
    @Next() next: NextFunction,
    @Auth() auth: AuthDto,
    @Param() { id }: UUIDParamDto,
    @Query() dto: ServeFileDto,
  ) {
    await sendFile(res, next, () => this.service.getOriginalBytes(auth, id, dto), this.logger);
  }

  /**
   *
   *  Replaces the asset with new file, without changing its id
   */
  @Put(':id/file')
  @UseInterceptors(FileUploadInterceptor)
  @ApiConsumes('multipart/form-data')
  @Authenticated({ sharedLink: true })
  @EndpointLifecycle({ addedAt: 'v1.106.0' })
  async replaceAsset(
    @Auth() auth: AuthDto,
    @Param() { id }: UUIDParamDto,
    @UploadedFiles(new ParseFilePipe({ validators: [new FileNotEmptyValidator([UploadFieldName.ASSET_DATA])] }))
    files: UploadFiles,
    @Body() dto: UpdateAssetMediaDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AssetMediaResponseDto> {
    const { file } = getFiles(files);
    const assetMediaResponse = await this.service.replaceAsset(auth, id, dto, file);
    if (assetMediaResponse.status === AssetMediaStatusEnum.DUPLICATE) {
      res.status(HttpStatus.OK);
    }
    return assetMediaResponse;
  }

  @Get(':id/thumbnail')
  @FileResponse()
  @Authenticated({ sharedLink: true })
  @EndpointLifecycle({ addedAt: 'v1.106.0' })
  async getThumbnailBytes(
    @Res() res: Response,
    @Next() next: NextFunction,
    @Auth() auth: AuthDto,
    @Param() { id }: UUIDParamDto,
    @Query() dto: GetAssetThumbnailDto,
  ) {
    await sendFile(res, next, () => this.service.getThumbnailBytes(auth, id, dto), this.logger);
  }

  /**
   * Checks if multiple assets exist on the server and returns all existing - used by background backup
   */
  @Post('exist')
  @HttpCode(HttpStatus.OK)
  @Authenticated()
  checkExistingAssets(
    @Auth() auth: AuthDto,
    @Body() dto: CheckExistingAssetsDto,
  ): Promise<CheckExistingAssetsResponseDto> {
    return this.service.checkExistingAssets(auth, dto);
  }

  /**
   * Checks if assets exist by checksums
   */
  @Post('bulk-upload-check')
  @HttpCode(HttpStatus.OK)
  @Authenticated()
  checkBulkUpload(
    @Auth() auth: AuthDto,
    @Body() dto: AssetBulkUploadCheckDto,
  ): Promise<AssetBulkUploadCheckResponseDto> {
    return this.service.bulkUploadCheck(auth, dto);
  }
}
