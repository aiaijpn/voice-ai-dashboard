@echo off
cd /d C:\Users\taro\Desktop\dev\voice-ai-dashboard

echo ==============================
echo 1回目 check-sheet-access
echo ==============================
node tmp\check-sheet-access-by-file.js

echo.
echo ==============================
echo 2回目 check-sheet-access
echo ==============================
node tmp\check-sheet-access-by-file.js

echo.
echo ==============================
echo 3回目 check-sheet-access
echo ==============================
node tmp\check-sheet-access-by-file.js

echo.
echo ==============================
echo 完了
echo ==============================
pause