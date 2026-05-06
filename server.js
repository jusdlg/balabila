const express = require('express');
const multer = require('multer');
const fs = require('fs-extra');
const cors = require('cors');
const path = require('path');
const { createWriteStream } = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 创建必要文件夹
const dirs = [
    './server/temp',
    './server/upload/videos',
    './server/upload/images',
    './data'
];
dirs.forEach(d => fs.ensureDirSync(d));

// 数据文件
const USER_FILE = './data/users.json';
const VIDEO_FILE = './data/videos.json';
const IMAGE_FILE = './data/images.json';
const MSG_FILE = './data/messages.json';

if (!fs.existsSync(USER_FILE)) fs.writeJSONSync(USER_FILE, []);
if (!fs.existsSync(VIDEO_FILE)) fs.writeJSONSync(VIDEO_FILE, []);
if (!fs.existsSync(IMAGE_FILE)) fs.writeJSONSync(IMAGE_FILE, []);
if (!fs.existsSync(MSG_FILE)) fs.writeJSONSync(MSG_FILE, []);

// 上传配置
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, './server/temp'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// 登录/注册
app.post('/api/login', async (req, res) => {
    const { phone, pwd } = req.body;
    let users = await fs.readJSON(USER_FILE);
    let user = users.find(u => u.phone === phone);

    if (!user) {
        user = { phone, pwd, createTime: new Date().toLocaleString() };
        users.push(user);
        await fs.writeJSON(USER_FILE, users, { spaces: 2 });
    }

    if (user.pwd !== pwd) return res.json({ ok: false, msg: '密码错误' });
    res.json({ ok: true, phone });
});

// 上传分片
app.post('/api/upload/chunk', upload.single('chunk'), async (req, res) => {
    const { index, fileId } = req.body;
    await fs.move(req.file.path, `./server/temp/${fileId}-${index}`, { overwrite: true });
    res.json({ code: 0 });
});

// 合并文件
app.post('/api/upload/merge', async (req, res) => {
    const { fileId, fileName, total, userPhone, type } = req.body;
    const ext = path.extname(fileName);
    const newName = Date.now() + ext;
    const saveDir = type === 'video' ? './server/upload/videos' : './server/upload/images';
    const filePath = path.join(saveDir, newName);

    const writeStream = createWriteStream(filePath);
    for (let i = 0; i < total; i++) {
        const chunkPath = `./server/temp/${fileId}-${i}`;
        writeStream.write(fs.readFileSync(chunkPath));
        fs.unlinkSync(chunkPath);
    }
    writeStream.end();

    const data = {
        id: Date.now(),
        userPhone,
        fileName: newName,
        fileUrl: `/server/upload/${type}s/${newName}`,
        time: new Date().toLocaleString()
    };

    const listFile = type === 'video' ? VIDEO_FILE : IMAGE_FILE;
    const list = await fs.readJSON(listFile);
    list.unshift(data);
    await fs.writeJSON(listFile, list, { spaces: 2 });

    res.json({ fileUrl: data.fileUrl });
});

// 获取首页视频
app.get('/api/videos', async (req, res) => {
    const list = await fs.readJSON(VIDEO_FILE);
    res.json(list);
});

// 获取我的视频/图片
app.post('/api/my/videos', async (req, res) => {
    const { userPhone } = req.body;
    const all = await fs.readJSON(VIDEO_FILE);
    res.json(all.filter(v => v.userPhone === userPhone));
});
app.post('/api/my/images', async (req, res) => {
    const { userPhone } = req.body;
    const all = await fs.readJSON(IMAGE_FILE);
    res.json(all.filter(i => i.userPhone === userPhone));
});

// 客服消息
app.post('/api/sendMsg', async (req, res) => {
    const { userPhone, content } = req.body;
    const msg = {
        id: Date.now(),
        userPhone,
        content,
        time: new Date().toLocaleString(),
        isAdmin: false
    };
    const msgs = await fs.readJSON(MSG_FILE);
    msgs.unshift(msg);
    await fs.writeJSON(MSG_FILE, msgs, { spaces: 2 });
    res.json({ ok: true });
});
app.get('/api/messages', async (req, res) => {
    res.json(await fs.readJSON(MSG_FILE));
});

// 静态文件服务
app.use('/server/upload', express.static('./server/upload'));

app.listen(3000, () => {
    console.log('服务运行：http://localhost:3000');
});