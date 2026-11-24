import {bindings} from '../../lib/hub.mjs';
import {acceptGameRewards} from '../../lib/game-rewards.mjs';
export const prerender=false;
export const POST=({request})=>acceptGameRewards(request,bindings);
