FROM denoland/deno:2.9.6

WORKDIR /app

COPY . .

EXPOSE 8080

CMD ["run", "--allow-net", "--allow-read", "--allow-env", "main.ts"]
