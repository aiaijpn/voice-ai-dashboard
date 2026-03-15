@echo off

echo === JS File Line Count (node_modules excluded) ===
echo.

for /f "delims=" %%f in ('dir /s /b *.js ^| findstr /v /i "\\node_modules\\"') do (
    for /f %%c in ('type "%%f" ^| find /v /c ""') do (
        echo %%c %%f
    )
)

echo.
echo === Done ===