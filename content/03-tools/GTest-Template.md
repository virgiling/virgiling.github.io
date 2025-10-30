---
title: GTest 单元测试模板
description:
tags:
  - 文具袋/环境配置
  - OS/Linux
date: 2025-10-30
lastmod: 2025-10-30
draft: false
location:
cover:
---

> [!warning]
>
> 本文不是教程，只是一个模板，方便本人复制粘贴而已
>
> 部分内容参考自博客 [GTest / GMock 单元测试实践手册](https://imageslr.com/2023/gtest)，详细的可以进博客学习

# 项目架构

假定项目的结构为：

```bash
.
├── build
├── CMakeLists.txt
├── Makefile
├── README.md
├── scripts
├── src
│   └── main.cpp
└── tests
    ├── CMakeLists.txt
    └── tree.cpp
```

我们在 `tests` 中写单元测试，其中，一个 `cpp` 文件是一个大的单元测试

# CMakeLists

我们在根目录的 `CMakeLists.txt` 的最后写上：

```cmake
...
enable_testing()
add_subdirectory(tests)
```

然后，在 `tests/CMakeLists.txt` 中写上：

```cmake
# Find required packages
find_package(GTest REQUIRED)

# Find all test source files
file(GLOB TEST_SOURCES "*.cpp")

# Create Library to Test
...

# For each test file, create a separate test executable
foreach(TEST_SOURCE ${TEST_SOURCES})
    get_filename_component(TEST_NAME ${TEST_SOURCE} NAME_WE)

    add_executable(${TEST_NAME}_test ${TEST_SOURCE})

    target_link_libraries(${TEST_NAME}_test
	    ${CUSTOM_LIBS}
    )

    # Add to CTest
    add_test(NAME ${TEST_NAME} COMMAND ${TEST_NAME}_test)
endforeach()
```

然后我们在根目录的 `Makefile` 下创建一个 `test` 目标：

```make {"添加目标test": 10-13}
.PHONY: all build test

# Default target
all: build

build:
	@cmake -S . -B build
	@cmake --build build -- -j$(shell nproc)


# Run tests
test: build
	@cd build && ctest --output-on-failure

# Run specific test by name
test-%: build
	@cd build && ctest -R $* --output-on-failure

# Run tests with verbose output
test-verbose: build
	@cd build && ctest -V

```

这样，我们写完测试后即可通过运行

```bash
make test
```

做单元测试

# 单元测试模板

这里我们通过 `TestFixture` 的方式来写单元测试，例如现在我有一个二叉树 `PartitionTree`，那么我们的单元测试如下：

```cpp {"共享变量": 18-21} {"单个测试点": 23-33} {"Debug信息，在测试失败时输出（可以自定义输出什么样的信息）": 8-12}
#include "partition_tree.hpp"
#include <gtest/gtest.h>
#include <sys/types.h>

class PartitionTreeTest : public ::testing::Test {
public:
  PartitionTree tree;

  std::string debug_message() {
    std::stringstream ss;
    return tree.to_string();
  }

protected:
  void SetUp() override { tree.init(n_threads); }

  void TearDown() override { tree.clear(); }

  std::vector<int> assumptions = {1, 2, 3, 4, 5, 6, 7};
  int depth = 3;
  int n_threads = 8;
};

TEST_F(PartitionTreeTest, BasicInitializationBinMode) {
  tree.init_with_binary(assumptions, depth, n_threads);
  EXPECT_TRUE(tree.m_root != nullptr);
  for (int i = 0; i < n_threads; i++) {
    EXPECT_TRUE((int)tree.collect_pre_decision(i).size() == depth);
  }
  EXPECT_TRUE(
      reinterpret_cast<Node *>(tree.m_wid_to_addr[0])->m_parent->m_split_lit ==
      3);
}

TEST_F(PartitionTreeTest, BasicInitializationScaMode) {

  tree.init_with_scattering(assumptions, 2);

  auto w0_pd = tree.collect_pre_decision(0);
  auto w1_pd = tree.collect_pre_decision(1);
  EXPECT_TRUE(w0_pd.size() == 1 && w1_pd.size() == 1);
  EXPECT_TRUE(w0_pd[0] == 1 && w1_pd[0] == -1) << debug_message();
}

TEST_F(PartitionTreeTest, BasicUpdateInBinMode) {
  tree.init_with_binary(assumptions, depth, n_threads);

  u_int64_t w1_addr = tree.m_wid_to_addr[1];

  tree.update(0, 1, 9);

  u_int64_t w1_addr_new = tree.m_wid_to_addr[1];

  EXPECT_TRUE(w1_addr != w1_addr_new);

  auto w0_pd = tree.collect_pre_decision(0);
  auto w1_pd = tree.collect_pre_decision(1);

  EXPECT_TRUE(w0_pd.size() == 4);
  EXPECT_TRUE(w1_pd.size() == 4);

  EXPECT_TRUE(w0_pd.back() == -9);
  EXPECT_TRUE(w1_pd.back() == 9);
}

TEST_F(PartitionTreeTest, BasicUpdateInScaMode) {
  tree.init_with_scattering(assumptions, n_threads);

  u_int64_t w1_addr = tree.m_wid_to_addr[1];

  tree.update(0, 1, 9);

  u_int64_t w1_addr_new = tree.m_wid_to_addr[1];

  EXPECT_TRUE(w1_addr != w1_addr_new) << debug_message();

  auto w0_pd = tree.collect_pre_decision(0);
  auto w1_pd = tree.collect_pre_decision(1);

  EXPECT_TRUE(w0_pd.size() == 2);
  EXPECT_TRUE(w1_pd.size() == 2);

  EXPECT_TRUE(w0_pd.back() == -9);
  EXPECT_TRUE(w1_pd.back() == 9);
}

int main(int argc, char **argv) {
  ::testing::InitGoogleTest(&argc, argv);
  return RUN_ALL_TESTS();
}

```

这个文件是一个大测试点，其中，每个小测试点 `Test Case` 通过 `TEST_F(TestFixure, TestCaseName)` 实现，我们这么写的原因是为了可以共享一些测试变量，也可以少写一些代码（

> [!tip]
>
> 继承自 `Test` 的类，其 `SetUp` 函数会在每个 `Test Case` 执行之前被调用，而 `TearDown` 函数则会在每个 `Test Case` 执行之后被调用。
