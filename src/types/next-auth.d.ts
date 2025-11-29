import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    twitter_username?: string | null;
    twitter_image?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    twitter_username?: string | null;
    twitter_image?: string | null;
  }
}
