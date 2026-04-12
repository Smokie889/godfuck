# TODO

## Current Status
中文說明：這裡記錄目前專案已經完成的功能，避免下次開工時忘記做到哪。

### Completed
- 已完成：將原本單一 HTML 的 client 拆成 CSS 與 ES modules。
- Modularized the client from a single HTML file into CSS and ES modules.
- 已完成：統一根目錄入口，並加入頁面內的進場 ID 輸入畫面。
- Unified the root entry page and added an in-page join screen for entering a player ID.
- 已完成：多人移動加入 client-side input history 與 reconciliation。
- Added multiplayer movement with client-side input history and reconciliation.
- 已完成：加入滑鼠左鍵射擊與本地散布 UI。
- Added left-click shooting with client-side spread UI.
- 已完成：將移動朝向與瞄準朝向拆開。
- Split movement facing and aim facing.
- 已完成：將 aim 同步從高頻 state 廣播改成節流的 aim event。
- Changed aim synchronization from per-state broadcast to throttled aim events.
- 已完成：子彈改成 spawn/remove 事件流程，並由 client 本地預測子彈飛行。
- Added bullet spawn/remove event flow with client-side bullet prediction.
- 已完成：加入本地預測命中停止，減少子彈穿過人後才命中的違和感。
- Added local visual bullet hit stop to reduce the feeling of bullets passing through targets.
- 已完成：聊天室側邊訊息與角色頭上 5 秒聊天泡泡。
- Added chat messages in the side panel and chat bubbles above players for 5 seconds.
- 已完成：世界大小從 500 擴大到 800。
- Increased the world size from 500 to 800.
- 已完成：玩家重生後散布會重設。
- Reset local spread after respawn.

## Pending
中文說明：這裡是還沒做的功能，照優先度往下排。

### High Priority
- 待做：如果現在槍感還是太鬆，要再縮短散布回復時間。
- Reduce spread recovery time further if the current weapon feel is still too loose.
- 待做：加入 `Shift` dash。
- Add `Shift` dash.
- 待做：加入 dash 用的體力值 UI。
- Add stamina UI for dash usage.
- 待做：體力不足時不能使用 dash。
- Prevent dash when stamina is insufficient.
- 待做：不 dash 時，體力值緩慢回復。
- Recover stamina slowly while not dashing.
- 規則已定：dash 過程中仍然可以被子彈打中，沒有無敵。
- Keep dash vulnerable to bullets. No invincibility during dash.

### Gameplay
- 待做：玩家不能互相重疊。
- Prevent players from overlapping.
- 待做：加入武器系統。
- Add a weapon system.

## Confirmed Design Decisions
中文說明：這裡是已經討論過、先確定的方向，之後不要忘記。

### Dash
- 決策：這款遊戲優先做 dash，不做持續 sprint。
- Dash is preferred over continuous sprint.
- 決策：dash 期間仍然會被子彈命中。
- Dash should still allow the player to be hit by bullets.
- 決策：dash 需要消耗體力值。
- Dash should consume stamina.

### Player Collision
- 決策：玩家碰撞首選方案是「圓形碰撞 + 位置優先權」。
- Preferred solution: circular collision with position priority.
- 決策：先站定位的人有優先權，不會被後來的人擠走。
- The player who is already occupying a position should keep priority.
- 決策：後來想進同一個位置的人應該被擋住。
- The later player should be blocked instead of pushing the first player away.
- 決策：預設不要做雙方平均推開。
- Do not use average push-apart as the default behavior.
- 備案：單軸分離只是備用方案，不是首選。
- Single-axis separation is only a backup option, not the preferred implementation.

## Notes
中文說明：這裡是一些之後回來開工時很容易忘記的技術備註。
- 備註：本地玩家的移動手感很吃 `client/src/config.js` 裡的 `LOCAL_RENDER_LERP` 和 prediction 參數。
- Local player movement feel currently depends heavily on `LOCAL_RENDER_LERP` and prediction tuning in [client/src/config.js](/e:/workspace/godfuck/client/src/config.js).
- 備註：子彈位置現在不是每 tick 廣播，而是 server 發 spawn/remove 事件，client 自己模擬飛行。
- Bullet positions are no longer broadcast every tick. The server sends bullet spawn/remove events and clients simulate bullet motion locally.
- 備註：瞄準方向現在不是高頻 state 的一部分，而是透過節流的 aim event 更新。
- Aim facing is no longer part of every high-frequency state broadcast. It is updated through throttled aim events.
- Player state broadcasts now send only changed players instead of resending the full player list every tick.
