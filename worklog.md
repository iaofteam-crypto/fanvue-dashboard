---
Task ID: 1
Agent: ia-of-team-3 (BOTARDO OS HB#56)
Task: Fanvue Dashboard - fix AELIANA chat, add agency scopes, improve cron sync

Work Log:
- git pull --rebase origin main (already up to date)
- Explored full project structure: 68 src/ files, 11 API routes, 9 dashboard components
- Ran Next.js build - compiled successfully (12/12 static pages)
- Identified z-ai-web-dev-sdk usage bug in /api/chat: used non-existent `createChatCompletion` named export
- Fixed /api/chat to use correct `ZAI.create()` → `zai.chat.completions.create()` pattern
- Added missing Fanvue OAuth scopes: `read:agency`, `write:agency` to src/lib/fanvue.ts
- Rewrote /api/crons/sync-fanvue to pull 9 Fanvue API endpoints (me, chats, posts, subscribers, followers, earnings, earnings-summary, media, tracking_links) with proper token refresh and result caching
- Updated connection-section to reflect full scope list
- Updated .env.example with DATABASE_URL
- Rebuilt successfully, committed and pushed to GitHub (4844c26..8e1b17a)

Stage Summary:
- AELIANA chat now uses correct z-ai-web-dev-sdk API pattern
- All Fanvue OAuth scopes included (openid, offline_access, read:self, read:creator, read:insights, read:fan, read:chat, read:media, read:post, read:tracking_links, read:agency, write:chat, write:creator, write:media, write:post, write:tracking_links, write:agency)
- sync-fanvue cron actively pulls data from 9 Fanvue API endpoints hourly
- Build passes cleanly, pushed to main
