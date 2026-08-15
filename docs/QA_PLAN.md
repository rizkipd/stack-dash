# Stack Dash --- QA Plan

## Critical Tests

1.  Stack starts with correct count for selected difficulty.
2.  Drag up/down changes only vertical position.
3.  Stack never exits playable bounds.
4.  Obstacles spawn ahead, not on top of player.
5.  One colliding block removes exactly one block.
6.  Multiple colliding blocks remove only those blocks.
7.  One block cannot be removed twice.
8.  Non-colliding blocks survive.
9.  1 → 0 blocks triggers Game Over once.
10. Retry resets score, stack, obstacles, collectibles and game state.
11. +1 collectible adds exactly one block.
12. Collectible cannot be collected twice.
13. Pause freezes simulation.
14. Resume continues correctly.
15. App background/resume does not cause a giant simulation delta.
16. Seeded obstacle generation is reproducible.
17. Generated obstacle sequences pass fairness validation.
18. High score persists after app restart.

## Stress / Edge Cases

-   [ ] 1 remaining block
-   [ ] Large stack
-   [ ] Two obstacle collisions in one frame
-   [ ] Rapid dragging
-   [ ] Finger leaves screen
-   [ ] Very high speed
-   [ ] Simulated low FPS
-   [ ] Pause during collision
-   [ ] Background app during run
-   [ ] 50+ consecutive retries
-   [ ] Narrow/tall phone
-   [ ] Wide phone
-   [ ] Corrupt/missing local save data

## QA Report Template

### Ticket

### Build/Commit

### Environment

### Result

PASS / FAIL

### Steps

### Expected

### Actual

### Severity

Blocker / Critical / Major / Minor

### Evidence

### Regression Risk

### Recommendation
