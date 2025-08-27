# Cursor Rules for AR Shooting Game

## Cursor Behavior
1. **Default State**: The cursor appears as a small crosshair or targeting reticle in the center of the screen.
2. **Active State**: When hovering over the AR bottle target, the cursor changes color or grows slightly to indicate it's over a valid target.
3. **Click/Tap State**: When the user taps the screen, the cursor briefly animates (e.g., contracts) to provide visual feedback of the shooting action.

## Interaction Logic
1. **Target Detection**: The cursor detects when it's over the AR bottle model using raycasting.
2. **Shooting Mechanics**: 
   - Tap anywhere on the screen to shoot
   - The shot travels from the camera position through the cursor point
   - Hit detection is calculated using Three.js raycasting

## Visual Feedback
1. **Hit Feedback**: When a shot hits the target, visual feedback includes:
   - Score increment
   - Particle effect at hit location
   - Brief color change or flash on the bottle
2. **Miss Feedback**: When a shot misses:
   - Small particle effect in the direction of the miss
   - No score change

## Performance Considerations
1. Cursor should remain responsive even on lower-end devices
2. Animation effects should be optimized for mobile performance
3. Cursor tracking should be smooth without lagging 