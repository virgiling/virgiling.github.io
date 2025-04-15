---
title: C++ 项目初始化指北
description: 
tags:
  - 文具袋/文具推荐
date: 2024-12-21
lastmod: 2025-04-15
draft: false
cover:
---

> [!tldr]
>
> 在 `Linux` 下通过 `cmake` 与 `Conan` 进行 `C++` 项目初始化与开发的一份简单指北

# 环境准备

首先，我们需要下载以下软件：

1. `cmake`
2. `make` 或者 `ninja`
3. `python3`
4. `pip` 或者 `pipx`
5. `clang` 系列工具： `clangd`, `clang(++)`, `clang-format`, `clang-tidy`
6. [cppcheck](https://cppcheck.sourceforge.io/)

需要注意的是，`CMake` 的版本最好在 `3.27` 以上，可以根据 [此教程](https://apt.kitware.com/) 来安装最新版本的 `CMake`，目前的最新版本是 `3.31`

关于 `clang` 工具链的版本，可以根据 [此教程](https://apt.llvm.org/) 进行安装

# 软件安装

我们采用 [cmake-init](https://github.com/friendlyanon/cmake-init) 来进行项目的初始化，并使用 [Conan2](https://conan.io/) 来作为包管理器，首先，我们通过 `pip` 安装：

```bash
pip install conan cmake-init
```

在正式开始初始化项目前，我们需要先初始化包管理器 `Conan2`：

```bash
conan profile detect --force
```

# 项目初始化

使用以下命令初始化一个名为 `demo` 的项目：

```bash
cmake-init demo
```

经过一系列选择，我们得到的文件树如下：

```txt
.
├── build
├── cmake
├── conan
├── docs
│   └── pages
├── source
└── test
    └── source
```

在初始化时，如果包管理器选择为 `Conan`，那么会生成一个 `conanfile.py` ，里面描述了依赖的包：

```py
from conan import ConanFile


class Recipe(ConanFile):
    settings = "os", "compiler", "build_type", "arch"
    generators = "CMakeToolchain", "CMakeDeps", "VirtualRunEnv"

    def layout(self):
        self.folders.generators = "conan"

    def requirements(self):
        self.requires("fmt/11.0.2")

    def build_requirements(self):
        self.test_requires("catch2/3.7.0")

```

我们首先安装这些包，使用命令：

```bash
conan install . -s build_type=Debug -b missing
```

随后，`Conan` 会生成一个文件夹 `conan`，并在其中生成一系列 `.cmake` 文件

接着，我们使用 `cmake` 的新特性 `Preset`，这也是为什么我们需要 `cmake` 的版本大于 3.27 的原因：

```bash
cmake --preset=dev
cmake --build --preset=dev
```

此时，我们就在 `build/dev` 文件下生成了一个可执行文件 `demo`，使用命令:

```bash
./build/dev/demo
```

即可运行

# 使用第三方库

我们在 [Conan](https://conan.io/center) 中可以搜索自己想要安装的包，例如 `unordered_dense`，然后，根据官网的说明，在 `conanfile.py` 与 `CMakeLists.txt` 中填入信息：

![image.png](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20241223192851364.png)

我们填入以下信息：

```py title="conanfile.py"
from conan import ConanFile


class Recipe(ConanFile):
    settings = "os", "compiler", "build_type", "arch"
    generators = "CMakeToolchain", "CMakeDeps", "VirtualRunEnv"

    def layout(self):
        self.folders.generators = "conan"

    def requirements(self):
        self.requires("fmt/11.0.2")
        self.requires("unordered_dense/4.4.0")

    def build_requirements(self):
        self.test_requires("catch2/3.7.0")

```

```cmake title="CMakeLists.txt"
find_package(fmt REQUIRED)
find_package(unordered_dense REQUIRED)
target_link_libraries(demo_lib PUBLIC fmt::fmt unordered_dense::unordered_dense)
```

> [!important]
>
> 值得注意的是，在 `CMakeLists.txt` 中指定的库，我们需要将其设置为 `PUBLIC`，否则会导致链接失败
