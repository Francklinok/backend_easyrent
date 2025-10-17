export interface ImageVariant {
  width: number;
  height: number;
  quality: number;
}

export interface CacheTTL {
  conversation: number;
  userConversations: number;
  searchIndex: number;
  patterns: number;
  reactions: number;
}

declare module '../../../config' {
  interface Config {
    cacheTTL: CacheTTL;
    imageVariants: {
      thumbnail: ImageVariant;
      medium: ImageVariant;
      large: ImageVariant;
    };
    typingTimeout: number;
    messageMaxLength: number;
  }
}
