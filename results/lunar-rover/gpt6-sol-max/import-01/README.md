# SELENE 07 月面探测场景

在本目录启动一个本地静态服务器，然后访问首页：

```bash
python3 -m http.server 8000
```

打开 `http://localhost:8000/`。页面使用本地 Three.js 模块和本地月壤纹理，运行时不依赖 CDN。

鼠标左键拖动可旋转视角，滚轮可缩放，右键拖动可平移。页面底部可暂停探测车和切换镜头。

月壤 PBR 纹理来自 [Poly Haven Moon 04](https://polyhaven.com/a/moon_04)，采用 CC0 许可。探测车、岩石、陨石坑、星空和地球由场景代码构建。
