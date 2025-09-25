# 使用一个轻量级的 Node.js 官方镜像作为基础
FROM public.ecr.aws/docker/library/node:18-alpine

# 在容器内创建一个目录来存放应用代码
WORKDIR /usr/src/app

# 拷贝 package.json 和 package-lock.json (或 yarn.lock)
# 利用 Docker 的层缓存机制，只有当这些文件变化时才重新安装依赖
COPY package*.json ./

# 安装项目依赖
# 使用 npm ci 可以确保安装与 package-lock.json 完全一致的依赖，构建更可靠
RUN npm ci

# 拷贝应用源代码到容器的工作目录
COPY . .

# 声明应用监听的端口
EXPOSE 3000

# 定义容器启动时运行的命令
CMD [ "node", "server.js" ]
