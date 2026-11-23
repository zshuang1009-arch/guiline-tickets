# 归线 · Windows 展览网站

## Windows 本地启动与 TouchDesigner 联调

1. 解压 ZIP，安装 Python 3（带 Windows 的 `py` 启动器）。双击 **start-exhibition.bat**，保持命令窗口打开，在同一台电脑访问 [http://localhost:8000](http://localhost:8000)。首次缺少 Pillow 时启动脚本会安装它。
2. 在 TouchDesigner 中启用现有 **Web Server DAT**，端口填 **9980**。若你的回调已能读取 `message['emotions']`，可继续使用。随包的 `td_callbacks.py` 是参考接收器，会把三个情绪填入同级的 `emotion_weights` 表格。其余情绪写 0。
3. 填完问卷并点击「完成问卷」。在 Web Server DAT 或回调里核对收到的三项是否与网页结果一致。同次提交只发送一次。关闭 Web Server DAT，再在网页做一次问卷，可以看到未连接提示。重新启用 DAT 后点「重新连接」，尚未发出的结果会发送。
4. 页面连接的是浏览器所在电脑的 `127.0.0.1`。聊天预览与手机另开网页时无法访问展览电脑的回环地址，请用展览电脑打开并联调。手机只访问二维码指向的票根页。若使用二维码，请确保手机与电脑在同一局域网；必要时用 `start-exhibition.bat --lan-ip 192.168.1.23` 指定展览电脑实际的局域网地址。
5. `start-demo.bat` 可用于本地查看页面。与展览模式一样，它会尝试连接本机 TD，票根区域没有示意图。

## 通信合同

问卷结果消息仅含 `type: "emotion_result"` 和 `emotions: [{name, score}, ...]`。前三项来自网页展示的真实结果，按分数降序排列。消息发送到 WebSocket 后，网站不会因重连再次发送同一份结果。发送本身不代表 TD 已处理，建议用 TD 回调日志确认。

TD 出图后，通过原有 WebSocket 向提交问卷的客户端发送 `emotion_image_ready`，包含 `imageUrl` 和 `filename`。文件名形如 `emotion_1795093643844003700.png`，地址须为 `http://127.0.0.1:9980/emotion-image/` 加文件名。每次截图须使用新文件名，每份结果发送一条图片通知。

展览网站进程从 TD 获取透明 PNG，并通过同源地址提供给电脑票根和手机保存页。浏览器能够将模型合成到最终 PNG，无需在 TD 配置 CORS。模型加载完成后，手机保存页才可导出票根。

缺少问卷 ID 时，同一连接只允许一份结果等待图片。超时不释放该位置，以免迟到的图被绑定到下一张票根。若 TD 已确定无法返回该图，可重启 Web Server DAT 并在网站重新连接以继续处理尚未发送的结果。启用多份并行出图前，须在网站与 TD 两端增加 `requestId`。

陆地轮廓来自 [Natural Earth](https://www.naturalearthdata.com/)，不含行政边界。地级市及中心点来自 [DataV 地图数据](https://datav.aliyun.com/portal/school/atlas/area_selector)，用作城市尺度的示意落点。

## 现场排查回图

重新启动网站后，在 Chrome 的 Console 搜索“归线 TD”，再提交一份问卷。日志依次应出现“WebSocket 已连接”“emotion_result 已发送”“收到 WebSocket 消息（emotion_image_ready）”“图片已保存到票根”“模型已绑定到票根”。请在实际提交问卷的标签页看日志。Network 中的 101 只代表握手成功，打开工具后刷新一次页面可以从握手开始记录。

如果已发送问卷却没有收到回图通知，请确认 TD 把通知发送给收到该问卷的 WebSocket 客户端，并检查 TD Textport 是否报错。能直接打开 PNG 表示 HTTP 图片可访问。网站收到通知后才会取图。若出现读取或保存失败，网站命令窗口会给出对应的 HTTP 或图片错误。

回图修复版启动后，命令窗口会显示“回图修复版”，并自动打开带版本标记的网页。端口被占用时，请先关闭旧的网站窗口。若本次问卷已经出图，但网站提示未收到通知，点击票根模型区域内的“补入模型图片”，粘贴本次 TD 生成的完整 PNG 地址。网站会将图片保存到当前票根，同一张图也会用于扫码保存。

### 展览模式自动出图

双击 start-exhibition.bat 时选择 TouchDesigner 实际保存 PNG 的文件夹。使用一个展览浏览器标签页，截图文件夹仅用于这一台展览站；每次问卷只输出一张新文件，沿用 emotion_数字.png 命名。网站忽略目录中已有的文件，读到此次完整截图后自动打开票根。扫码页已打开时也会自动更新。若上一次未出图，请先确认 TD 不再执行旧截图任务，再重启网站，以免把迟到的图片配给下一位观众。
