import type { ChangeEvent, DragEvent, RefObject } from 'react';
import type React from 'react';
import { Upload } from 'lucide-react';
import { Button } from '../../../components/ui';
import { APP_CURRENCY_CODE } from '../../../format/currency';
import {
  DropHint,
  HiddenFileInput,
  UploadBox,
  UploadFootnote,
  UploadIconWrap,
  UploadInner,
  UploadPrimaryText,
  UploadSecondaryText,
  UploadedFileName,
} from '../importPageStyles';

type ImportUploadSectionProps = {
  isDragActive: boolean;
  uploadedFileName: string;
  fileInputRef: RefObject<HTMLInputElement>;
  onDragActiveChange: (active: boolean) => void;
  onDropFile: (event: DragEvent<HTMLDivElement>) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export const ImportUploadSection = ({
  isDragActive,
  uploadedFileName,
  fileInputRef,
  onDragActiveChange,
  onDropFile,
  onFileChange,
}: ImportUploadSectionProps): JSX.Element => {
  return (
    <UploadBox
      $isDragActive={isDragActive}
      onDragOver={(event) => {
        event.preventDefault();
        onDragActiveChange(true);
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        onDragActiveChange(true);
      }}
      onDragLeave={() => onDragActiveChange(false)}
      onDrop={onDropFile}
    >
      <UploadInner>
        <UploadIconWrap aria-hidden>
          <Upload size={44} strokeWidth={1.8} />
        </UploadIconWrap>
        <UploadPrimaryText>Upload Bank Statement</UploadPrimaryText>
        <UploadSecondaryText>
          Supports CSV/TXT formats (currency column optional, stored as {APP_CURRENCY_CODE})
        </UploadSecondaryText>
        {isDragActive ? <DropHint>Drop file here</DropHint> : null}
        <Button type="button" $variant="accent" $weight="semibold" onClick={() => fileInputRef.current?.click()}>
          Choose File
        </Button>
        <HiddenFileInput
          ref={fileInputRef as React.RefObject<HTMLInputElement>}
          type="file"
          accept=".csv,text/csv,.txt"
          onChange={onFileChange}
        />
        {uploadedFileName ? <UploadedFileName>Selected file: {uploadedFileName}</UploadedFileName> : null}
        <UploadFootnote>Your data is processed locally and never uploaded without your approval.</UploadFootnote>
      </UploadInner>
    </UploadBox>
  );
};
