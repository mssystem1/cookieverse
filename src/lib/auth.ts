import TwitterProvider from "next-auth/providers/twitter";
import type { NextAuthOptions } from "next-auth";

export const authOptions: NextAuthOptions = {
  providers: [
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      version: "2.0",
    }),
  ],
  callbacks: {
    async jwt({ token, profile, user }: any) {
      if (profile) {
        token.twitter_username =
          profile.username ||
          profile.screen_name ||
          profile.data?.username ||
          null;
        // 👇 FIX: handle both v1 & v2 shapes
        token.twitter_image =
          profile.data?.profile_image_url || // OAuth 2.0 shape
          profile.profile_image_url ||       // fallback (just in case)
          user.image ||                   // normalized user from NextAuth
          user.profile_image_url ||       // fallback
          null;
      }
      return token;
    },
    async session({ session, token }: any) {
      (session as any).twitter_username = token.twitter_username || null;
      (session as any).twitter_image = (token as any).twitter_image ?? null;
      return session;
    },
  },
  session: { strategy: "jwt" },
};
