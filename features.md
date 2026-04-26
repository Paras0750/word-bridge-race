High impact / low effort                                                                                                     
   
  1. Round timer "rush" tier — last 10s of round_max plays a faster pulse on the time bar, slight haptic vibration on mobile   
  (navigator.vibrate). Frees up tension without changing rules.                                                              
  2. Keyboard shortcut hints — small bottom strip in active round: Enter to submit · Esc to clear. Helps desktop players, costs
   nothing.                                                                                                                    
  3. "Same word, twice" detector — when two players submit the same invalid word back-to-back within 1s, log a "🪞  hivemind"
  entry. Free flavor.                                                                                                          
  4. Final game scoreboard — when host clicks End Game, show a polished "Game over" screen with the full game stats (rounds
  played, total cheats, total skips, best win time) before returning to lobby.                                                 
  5. Copy invite link — replace the "copy code" button with "copy invite link" that copies
  https://wbr.your-domain/?room=X4P9KM. One click vs two.                                                                      
                                                                  
  Medium impact / medium effort                                                                                                
                                                                  
  6. Spectator mode for late joiners — if you join after a round started, you watch read-only and queue for next round. Removes
   the "Round already in progress" wall.
  7. Difficulty modes — host picks "easy / normal / hard". Hard restricts to words ≥6 letters or excludes the start letter from
   being picked by a vowel-averse picker. Builds on existing settings.                                                         
  8. Per-round leaderboard sticky — show top 3 of the room as a small chip strip at the top of every active round, not just on
  scoreboard.                                                                                                                  
  9. "Almost!" hint — if a submitted word is one edit-distance from a valid bridge, hint "close…" without revealing it. Good
  for keeping struggling players engaged.                                                                                      
  10. Custom room names — let host name the room ("Friday Trivia") in addition to the code. Shows in browser tab title and
  shared link preview.                                                                                                         
                                                                  
  High impact / high effort                                                                                                    
                                                                  
  11. Persistent player profiles — sign in with email-magic-link or just a stable name+avatar. Cross-room stats: lifetime wins,
   fastest answer, longest streak, most-used word. Needs SQLite/Postgres.
  12. Daily challenge — fixed letters of the day, everyone in the world plays the same constraint, leaderboard of fastest valid
   answers. Needs persistence + a cron.                                                                                        
  13. Themed dictionaries — host swaps to "Tolkien", "Sci-fi", "Pokémon names". Each is a separate Set. Easy data work, harder
  UX (selector, source-attribution).                                                                                           
  
  15. Tournament mode — best-of-N rounds, knockout brackets, host names a winner at the end. Lots of state management.         
                                                                                                                               
  Polish / quality-of-life                                                                                                     
                                                                                                                               
  16. Sound effects — subtle ding on countdown 0, soft "buzz" on cheater, drumroll on winner reveal. Needs a few .mp3 assets   
  and use-sound lib (~3KB).                                       
  17. Animated entrance — cards fade-in / slide-up on phase transition. Already imported tw-animate-css but barely used.       
  18. Light mode — currently dark is hardcoded on <html>. Add a toggle. Trivial.                                               
  19. Avatar picker — instead of name initials in a circle, pick from 30 emoji avatars. More expressive in standings.          
  20. Accessibility pass — keyboard navigation for the letter picker grid, ARIA live regions for round phase changes, focus    
  management between phases.                                                                                                   
                                                                                                                               
  Anti-cheat (more theater)                                                                                                    
                                                                  
  21. DevTools open detection — broadcast "🕵️  Player2 is staring at the source code" if devtools opens during active round.    
  False-positive risk, but funny.
  22. Window-resize during round — "📏 Player2 just made the window bigger to see better". Pure shame.                         
  23. Multiple accounts on same network — same IP submitting same word in two rooms = sus. Ranking-only signal, no penalty.    
  24. Submission entropy check — if someone's first word is always wildly long and rare, flag as "suspiciously well-prepared". 
                                                                                                                               
  Operations / scale                                                                                                           
                                                                                                                               
  25. Admin endpoint — GET /admin/rooms?token=... returns a snapshot of active rooms, player counts, phase. Useful for         
  debugging in prod without grepping logs.
  26. Per-room rate limit — cap submit_word to ~10/sec per player to prevent client-side spam loops.                           
  27. Graceful shutdown — on SIGTERM, broadcast a "server restarting in 10s" toast to all rooms, then close. Otherwise everyone
   sees "disconnected" with no warning during deploys.                                                                         
  shared link preview.

  High impact / high effort

  11. Persistent player profiles — sign in with email-magic-link or just a stable name+avatar. Cross-room stats: lifetime wins,
   fastest answer, longest streak, most-used word. Needs SQLite/Postgres.
  12. Daily challenge — fixed letters of the day, everyone in the world plays the same constraint, leaderboard of fastest valid
   answers. Needs persistence + a cron.
  13. Themed dictionaries — host swaps to "Tolkien", "Sci-fi", "Pokémon names". Each is a separate Set. Easy data work, harder
  UX (selector, source-attribution).
  14. Voice rooms — WebRTC peer-to-peer audio so people can shout while playing. Real party-game vibes. Significant scope.
  15. Tournament mode — best-of-N rounds, knockout brackets, host names a winner at the end. Lots of state management.

  Polish / quality-of-life

  16. Sound effects — subtle ding on countdown 0, soft "buzz" on cheater, drumroll on winner reveal. Needs a few .mp3 assets
  and use-sound lib (~3KB).
  17. Animated entrance — cards fade-in / slide-up on phase transition. Already imported tw-animate-css but barely used.
  18. Light mode — currently dark is hardcoded on <html>. Add a toggle. Trivial.
  19. Avatar picker — instead of name initials in a circle, pick from 30 emoji avatars. More expressive in standings.
  20. Accessibility pass — keyboard navigation for the letter picker grid, ARIA live regions for round phase changes, focus
  management between phases.

  Anti-cheat (more theater)

  21. DevTools open detection — broadcast "🕵️  Player2 is staring at the source code" if devtools opens during active round.
  False-positive risk, but funny.
  22. Window-resize during round — "📏 Player2 just made the window bigger to see better". Pure shame.
  23. Multiple accounts on same network — same IP submitting same word in two rooms = sus. Ranking-only signal, no penalty.
  24. Submission entropy check — if someone's first word is always wildly long and rare, flag as "suspiciously well-prepared".

  Operations / scale

  25. Admin endpoint — GET /admin/rooms?token=... returns a snapshot of active rooms, player counts, phase. Useful for
  debugging in prod without grepping logs.
  26. Per-room rate limit — cap submit_word to ~10/sec per player to prevent client-side spam loops.
  27. Graceful shutdown — on SIGTERM, broadcast a "server restarting in 10s" toast to all rooms, then close. Otherwise everyone
   sees "disconnected" with no warning during deploys.
  28. Health metrics endpoint — extend /healthz with histograms (round duration, words submitted, cheaters/round). Hook to
  Grafana later.


  High impact / high effort

  11. Persistent player profiles — sign in with email-magic-link or just a stable name+avatar. Cross-room stats: lifetime wins,
   fastest answer, longest streak, most-used word. Needs SQLite/Postgres.
  12. Daily challenge — fixed letters of the day, everyone in the world plays the same constraint, leaderboard of fastest valid
   answers. Needs persistence + a cron.
  13. Themed dictionaries — host swaps to "Tolkien", "Sci-fi", "Pokémon names". Each is a separate Set. Easy data work, harder
  UX (selector, source-attribution).
  14. Voice rooms — WebRTC peer-to-peer audio so people can shout while playing. Real party-game vibes. Significant scope.
  15. Tournament mode — best-of-N rounds, knockout brackets, host names a winner at the end. Lots of state management.

  Polish / quality-of-life

  16. Sound effects — subtle ding on countdown 0, soft "buzz" on cheater, drumroll on winner reveal. Needs a few .mp3 assets
  and use-sound lib (~3KB).
  17. Animated entrance — cards fade-in / slide-up on phase transition. Already imported tw-animate-css but barely used.
  Polish / quality-of-life

  16. Sound effects — subtle ding on countdown 0, soft "buzz" on cheater, drumroll on winner reveal. Needs a few .mp3 assets
  and use-sound lib (~3KB).
  17. Animated entrance — cards fade-in / slide-up on phase transition. Already imported tw-animate-css but barely used.
  18. Light mode — currently dark is hardcoded on <html>. Add a toggle. Trivial.
  19. Avatar picker — instead of name initials in a circle, pick from 30 emoji avatars. More expressive in standings.
  20. Accessibility pass — keyboard navigation for the letter picker grid, ARIA live regions for round phase changes, focus
  management between phases.

  Anti-cheat (more theater)

  21. DevTools open detection — broadcast "🕵️  Player2 is staring at the source code" if devtools opens during active round.
  False-positive risk, but funny.
  22. Window-resize during round — "📏 Player2 just made the window bigger to see better". Pure shame.
  23. Multiple accounts on same network — same IP submitting same word in two rooms = sus. Ranking-only signal, no penalty.
  24. Submission entropy check — if someone's first word is always wildly long and rare, flag as "suspiciously well-prepared".

  Operations / scale

  25. Admin endpoint — GET /admin/rooms?token=... returns a snapshot of active rooms, player counts, phase. Useful for
  debugging in prod without grepping logs.
  26. Per-room rate limit — cap submit_word to ~10/sec per player to prevent client-side spam loops.
  27. Graceful shutdown — on SIGTERM, broadcast a "server restarting in 10s" toast to all rooms, then close. Otherwise everyone
   sees "disconnected" with no warning during deploys.
  28. Health metrics endpoint — extend /healthz with histograms (round duration, words submitted, cheaters/round). Hook to
  Grafana later.

  ---
  My recommendation if you only pick three: #11 (profiles) for stickiness, #16 (sound effects) for vibe, #27 (graceful
  shutdown) for the ops footgun you'll hit on the next deploy.


14. Voice rooms — WebRTC peer-to-peer audio so people can shout while playing. Real party-game vibes. Significant scope.