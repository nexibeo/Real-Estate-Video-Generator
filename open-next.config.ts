import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// No incremental cache: nothing on this site uses ISR. Every page is either
// fully static or rendered per request, so there is nothing for R2 to hold.
export default defineCloudflareConfig({});
