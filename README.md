# 中术大学 (University of Vocaloid China) 网站仓库

本项目是一个基于 [MkDocs](https://www.mkdocs.org/) 框架构建的静态文档网站，采用了 [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/) 主题。

如果你已经有几个月未使用该项目、对操作流程感到生疏，以下是一份详细的项目结构梳理、环境配置与日常生成的指南，希望能帮你快速找回开发状态。

>  注：已经配置 Github workflow ，只需要 `push` 到主分支就会自动部署网页内容，不需要手动输入各个配置命令

---

## 📂 项目结构概览

```text
University-of-Vocaloid-China/
├── mkdocs.yml          # 【核心】MkDocs 配置文件（修改网站侧边导航栏、主题样式和配置插件均在此处）
├── requirements.txt    # Python 环境依赖表，记录了运行/构建本项目需要的第三方包
├── docs/               # 存放所有源 Markdown 文稿与静态资源的源目录（你写文章的主要工作区）
│   ├── index.md        # 网站的主页（Home）
│   ├── Chinese_Songs/  # 中V推歌归档目录（如 2024_Fall 等）
│   ├── Japanese_Songs/ # 日V推歌归档目录
│   ├── Synthesis/      # 调校类活动等记录（如“拾光忆绫”、“依言依语”等）
│   ├── Works/          # 各种产出（原创、翻调、PV绘画、宣传海报等）
│   ├── Stages/         # 演出活动记录
│   ├── Movies/         # 观影会活动记录
│   ├── img/            # 图片及媒体资源目录（含网站 Logo 等）
│   └── overrides/      # MkDocs-Material 提供的前端覆写文件（如 404.html）
├── site/               # 【自动生成】执行构建命令后生成的纯静态网站文件存放处，不需要直接修改这里的内容。
└── README.md           # 本说明文档
```

---

## 🛠️ 环境配置指引

要在本地成功运行并预览此网站，请准备好 Python 环境：

1. **检查 Python 环境**
   确保你的系统上已安装较新版本的 Python (推荐 3.x 及以上)。可以在终端中输入 `python --version` 检查。
2. **安装并恢复依赖项**
   请在当前项目根目录开启终端，键入并执行以下命令：

   ```bash
   pip install -r requirements.txt
   ```

   *说明：这一步会自动为你安装构建该网站必备的 `mkdocs`、`mkdocs-material` 页面主题、`mkdocs-document-dates` 以及相关 Markdown 解析组件。*

---

## 🚀 网站配置与发布指南

下面是在这个仓库中最常用的几条命令及操作流程：

### 1. 本地实时预览（日常写作状态）

**这是你写文章时最常用的功能。**
在开始编辑 Markdown 文档排版前，打开终端并输入：

```bash
mkdocs serve
```

系统会搭建一个本地测试服务器，通常你可以通过浏览器访问控制台输出的地址（如 `http://127.0.0.1:8000/`）。
服务开启后，你对 `docs/` 目录里的任何 `.md` 文件的修改，在保存的瞬间网页上就会**自动刷新**生效。

### 2. 编写并新增文章网页

当你想为网站新加入一篇文章时，必须进行两步操作，否则网页上找不到：

1. **新建并攥写：** 先在 `docs/` 内对应的归类目录里建立 Markdown (`.md`) 文件，并写好内容。
2. **挂载到导航：** 打开根目录的 **`mkdocs.yml`** 配置文件，往下翻找到 `nav:` 对应的导航树结构。按 YAML 语法规范格式填入新增文件的相对路径，就像这样：
   ```yaml
   nav:
       - 中V推歌:
           - 2025 Fall:
               - 你的最新文章标题: ./Chinese_Songs/2025_Fall/你的最新文章文件名.md
   ```

### 3. 生成静态网页 (Build)

如果你想自己打包生成出最终能够公开部署的静态网页，执行：

```bash
mkdocs build
```

指令跑完后，你就会发现源工程根目录下多出了一个（或更新了） `site/` 文件夹。这里面全都是能直接放在服务器或云存储上展示的 HTML、CSS、JS。

### 4. 自动化推送发布 (Deploy)

要是你以前经常使用 [GitHub Pages](https://pages.github.com/) 托载静态站，可以直接使用：

```bash
mkdocs gh-deploy
```

运行后，程序会自动跑一遍 build，并将最新生成的网页内容推送到 GitHub 特定的分支上（ `gh-pages` 分支），域名（`wiki.feixilu.top`）不久后便会更新。
