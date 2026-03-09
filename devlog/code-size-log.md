# Code Size Log

## 2026-03-09

ads/ads.js : 10  
ads/adService.js : 100  
ai/classifier.js : 99  
line/handler.js : 165  
line/historyStore.js : 121  
repositories/sheetRepository.js : 24  
routes/operatorProfile.js : 20  
services/messageService.js : 243  
services/operatorProfileService.js : 41  
sheet/saver.js : 110  
utils/logger.js : 19  
server.js : 328

PS C:\Users\taro\Desktop\dev\voice-ai-dashboard>
PS C:\Users\taro\Desktop\dev\voice-ai-dashboard>
PS C:\Users\taro\Desktop\dev\voice-ai-dashboard> Get-ChildItem -Recurse -File -Include *.js |
>> Where-Object { $_.FullName -notmatch '\\node_modules\\' } |
>> ForEach-Object {
>>   $count = (Get-Content $_.FullName).Length
>>   Write-Host "$($_.FullName) : $count"
>> }
C:\Users\taro\Desktop\dev\voice-ai-dashboard\ads\ads.js : 10
C:\Users\taro\Desktop\dev\voice-ai-dashboard\ads\adService.js : 100
C:\Users\taro\Desktop\dev\voice-ai-dashboard\ai\classifier.js : 99
C:\Users\taro\Desktop\dev\voice-ai-dashboard\line\handler.js : 165
C:\Users\taro\Desktop\dev\voice-ai-dashboard\line\historyStore.js : 121
C:\Users\taro\Desktop\dev\voice-ai-dashboard\repositories\sheetRepository.js : 24
C:\Users\taro\Desktop\dev\voice-ai-dashboard\routes\operatorProfile.js : 20
C:\Users\taro\Desktop\dev\voice-ai-dashboard\services\messageService.js : 243
C:\Users\taro\Desktop\dev\voice-ai-dashboard\services\operatorProfileService.js : 41
C:\Users\taro\Desktop\dev\voice-ai-dashboard\sheet\saver.js : 110
C:\Users\taro\Desktop\dev\voice-ai-dashboard\utils\logger.js : 19
C:\Users\taro\Desktop\dev\voice-ai-dashboard\server.js : 328
PS C:\Users\taro\Desktop\dev\voice-ai-dashboard>
PS C:\Users\taro\Desktop\dev\voice-ai-dashboard>
>>
>> 
