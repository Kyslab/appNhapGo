# Cài app Android không dùng IP

Mục tiêu sau khi hoàn tất một lần:

- API chạy tại một địa chỉ HTTPS cố định trên Render.
- Điện thoại cài file APK như ứng dụng Android bình thường.
- Không cần Expo Go, không quét QR và không cần máy tính chạy hằng ngày.

## 1. Đưa API lên Render

1. Đẩy commit mới nhất lên GitHub bằng GitHub Desktop.
2. Mở:
   `https://dashboard.render.com/blueprint/new?repo=https%3A%2F%2Fgithub.com%2FKyslab%2FappNhapGo`
3. Đăng nhập Render bằng GitHub và tạo Blueprint.
4. Khi Render hỏi biến môi trường, nhập:
   - `DATABASE_URL`: chuỗi kết nối Neon của dự án.
   - `APP_API_KEY`: cùng giá trị đang dùng trong `api/.env`.
5. Chờ trạng thái dịch vụ thành `Live`.
6. Mở đường dẫn `/health/db` của dịch vụ. Kết quả đúng là:

```json
{"ok":true,"database":"connected"}
```

Ghi lại URL HTTPS thật do Render cấp, ví dụ:
`https://kyslab-appnhapgo-api.onrender.com`.

Render tự động triển khai lại API khi nhánh `main` có commit mới. Container cũng tự chạy migration database trước khi khởi động API.

## 2. Tạo file APK bằng EAS

Chỉ cần cấu hình tài khoản Expo trong lần đầu:

```powershell
cd mobile
npx eas-cli@latest login
npx eas-cli@latest build:configure
```

Tạo hai biến cho môi trường `production` trong trang Environment variables của dự án Expo:

- `EXPO_PUBLIC_API_URL`: URL HTTPS thật ở bước 1, không có dấu `/` cuối.
- `EXPO_PUBLIC_API_KEY`: cùng giá trị `APP_API_KEY` trên Render.

Sau đó build APK:

```powershell
npx eas-cli@latest build --platform android --profile apk
```

Khi EAS hoàn tất, mở đường dẫn tải xuống trên điện thoại và cài file `.apk`.

## 3. Cập nhật app sau này

Khi có phiên bản mới:

1. Tăng `expo.version` và `android.versionCode` trong `mobile/app.json`.
2. Chạy lại lệnh build profile `apk`.
3. Tải APK mới và cài đè lên bản cũ.

Database và ảnh nằm trên Neon nên không mất khi thay APK hoặc đổi điện thoại.
