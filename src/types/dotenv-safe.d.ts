declare module 'dotenv-safe' {
  export interface DotenvSafeOptions {
    path?: string;
    example?: string;
    encoding?: string;
    allowEmptyValues?: boolean;
  }

  export interface DotenvConfigOutput {
    error?: Error;
    parsed?: { [name: string]: string };
  }

  export function config(options?: DotenvSafeOptions): DotenvConfigOutput;
  
  const dotenvSafe: {
    config: typeof config;
  };

  export default dotenvSafe;
}