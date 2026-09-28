# Home Control Web

Web interface for 4 switches/lights using Firebase Realtime Database.

## Firebase
Database URL:
https://my-home-control-b16ec-default-rtdb.firebaseio.com

## Files
- index.html
- style.css
- app.js

Upload these files to a GitHub repository and enable GitHub Pages.

## Database structure
{
  "devices": {
    "switch1": false,
    "switch2": false,
    "switch3": false,
    "switch4": false
  }
}

Use Firebase Test Mode only for initial testing. Configure secure Firebase Rules before real deployment.
