## Routes
- /
- /login
- /register
- /settings


## Login Page

![icon]

歡迎回來！

登入您的帳戶

電子郵件 [your@email.com]

密碼 [...]

[ ] 記住我

[[ 登入 ]]

還沒有帳號？[立即註冊](/register)

## Register Page

![icon]

建立帳號

開始與朋友聊天

使用者名稱 [您的名稱]

電子郵件 [your@email.com]

密碼 [至少 8 個字元]

確認密碼 [再次輸入密碼]

[[ 註冊 ]]

已經有帳號？[立即登入](/login)

## Main Page

### 左側欄

DB-9CHAT [+](新增聊天室)

<chat type=msg name="陳小明"/>

<chat type=group name="師大資工117"/>

<folder display=collapsed name="學業">
<chat type=msg name="李大大"/>
<chat type=group name="資料庫報告第九組"/>
</folder>

<folder display=collapsed name="生活">
<chat type=msg name="多點鹽不健康餐盒"/>
</folder>

<hr/>

<vert>
<vertitem>
<self-icon/>
</vertitem>
<vertitem>
我
your@email.com
</vertitem>
</vert>

[設定](/settings) [[登出]]

### 主側欄

<heading>
<chat_name/><chat_settings condition="type=group"/><chat_options/>
</heading>

<main_content/>

<input_box/>

#### Chat Options

- 修改暱稱
- 退出聊天室 / 封鎖

#### Chat Settings

基本資訊
聊天室名稱
隨機討論
描述
隨意聊天的地方

[ ] 公開聊天室
允許任何人加入此聊天室

---

成員管理
共 3 位成員 [[邀請成員]]
我
member

吳同學
owner

鄭朋友
member

---

權限設定

[ ]允許成員邀請他人
    成員可以邀請新成員加入聊天室

[ ]允許成員上傳檔案
    成員可以在聊天室中上傳檔案

---

危險區域
[[刪除聊天室]]
    刪除後將無法復原，所有訊息和成員資料都會被永久刪除

[[取消]] [[儲存變更]]


### 成員列表
- (只有 type=group 才要顯示)

## Settings
 
返回聊天

個人資料
使用者名稱
電子郵件
asdf@adlkf.com
頭像
變更頭像
通知設定
啟用桌面通知

啟用訊息音效

外觀
主題

淺色
語言
顯示語言

繁體中文
安全性
變更密碼
取消
儲存變更
