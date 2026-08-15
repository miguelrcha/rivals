// Minimal ambient types for the File System Access API (Chromium-only,
// not yet in TypeScript's DOM lib). Only the surface this app uses.
export {};

declare global {
  interface FileSystemFileHandle {
    readonly kind: "file";
    readonly name: string;
    getFile(): Promise<File>;
  }

  interface FilePickerAcceptType {
    description?: string;
    accept: Record<string, string | string[]>;
  }

  interface OpenFilePickerOptions {
    multiple?: boolean;
    excludeAcceptAllOption?: boolean;
    types?: FilePickerAcceptType[];
  }

  interface Window {
    showOpenFilePicker?(
      options?: OpenFilePickerOptions,
    ): Promise<FileSystemFileHandle[]>;
  }
}
