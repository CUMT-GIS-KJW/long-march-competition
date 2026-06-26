# GitHub 上传说明

## 上传前检查

1. 不要上传真实密钥文件：`.env` 已经写入 `.gitignore`，正常执行 `git add .` 不会提交它。
2. 可以上传 `.env.example`，它只放示例配置，方便别人知道需要哪些环境变量。
3. 不需要上传 `node_modules/`，项目运行依赖由 `package.json` 和 `package-lock.json` 管理。

## 命令行上传

先在 GitHub 网页创建一个空仓库，例如：

```text
https://github.com/你的用户名/long-march-competition.git
```

然后在项目目录执行：

```powershell
cd "C:\Users\Kou Jiawei\Desktop\long-march-competition\long-march-competition"
git init
git add .
git commit -m "Initial Long March WebGIS project"
git branch -M main
git remote add origin https://github.com/你的用户名/long-march-competition.git
git push -u origin main
```

如果已经绑定过远程仓库，改用：

```powershell
git remote -v
git remote set-url origin https://github.com/你的用户名/long-march-competition.git
git push -u origin main
```

如果提示 `git` 不是内部或外部命令，需要先安装 Git for Windows，或使用 GitHub Desktop 上传。

## GitHub Desktop 上传

1. 打开 GitHub Desktop。
2. 选择 `File` -> `Add local repository`。
3. 选择项目目录：`C:\Users\Kou Jiawei\Desktop\long-march-competition\long-march-competition`。
4. 如果提示不是 Git 仓库，选择创建仓库。
5. 填写提交说明，例如 `Initial Long March WebGIS project`。
6. 点击 `Commit to main`。
7. 点击 `Publish repository` 上传到 GitHub。

## 后续更新

每次修改后执行：

```powershell
git status
git add .
git commit -m "Update project"
git push
```

## 下载后运行

别人从 GitHub 下载后，在项目目录执行：

```powershell
npm.cmd start
```

然后打开：

```text
http://localhost:8096
```
