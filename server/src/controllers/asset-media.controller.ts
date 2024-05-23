import {
  Body,
  Controller,
  HttpStatus,
  Inject,
  Param,
  ParseFilePipe,
  Put,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { EndpointLifecycle } from 'src/decorators';
import { DefaultAssetMediaResponseDto } from 'src/dtos/asset-media-response.dto';
import { UpdateAssetMediaDto, UploadFieldName } from 'src/dtos/asset-media.dto';
import { AuthDto } from 'src/dtos/auth.dto';
import { ILoggerRepository } from 'src/interfaces/logger.interface';
import { Auth, Authenticated } from 'src/middleware/auth.guard';
import { FileUploadInterceptor, Route, UploadFiles, getFiles } from 'src/middleware/file-upload.interceptor';
import { AssetMediaService } from 'src/services/asset-media.service';
import { FileNotEmptyValidator, UUIDParamDto } from 'src/validation';

@ApiTags('Asset')
@Controller(Route.ASSET)
export class AssetMediaController {
  constructor(
    @Inject(ILoggerRepository) private logger: ILoggerRepository,
    private service: AssetMediaService,
  ) {}

  @Put(':id/file')
  @UseInterceptors(FileUploadInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Replaces the asset with new file, without changing its id',
    type: UpdateAssetMediaDto,
  })
  @Authenticated({ sharedLink: true })
  @EndpointLifecycle({ addedAt: 'v1.106.0' })
  async replaceAsset(
    @Auth() auth: AuthDto,
    @Param() { id }: UUIDParamDto,
    @UploadedFiles(new ParseFilePipe({ validators: [new FileNotEmptyValidator([UploadFieldName.ASSET_DATA])] }))
    files: UploadFiles,
    @Body() dto: UpdateAssetMediaDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<DefaultAssetMediaResponseDto> {
    const { file } = getFiles(files);
    const assetMediaResponse = await this.service.replaceAsset(auth, id, dto, file);
    if (assetMediaResponse.status === 'duplicate') {
      res.status(HttpStatus.OK);
    }
    return assetMediaResponse;
  }
}