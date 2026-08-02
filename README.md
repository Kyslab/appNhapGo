# appNhapGo

Ứng dụng Android kiểm nhận gỗ tại kho từ danh sách Excel.

Luồng chính:

1. Chọn file `.xlsx` trên điện thoại.
2. API đọc danh sách và lưu từng `Log No.` vào Neon PostgreSQL.
3. Nhân viên nhập số Log khi cây về kho.
4. Nếu Log tồn tại, app hiển thị thông số và mở camera.
5. Ảnh được nén còn tối đa 1.600 px, gửi qua API và lưu trong PostgreSQL dạng `bytea`.

## Cấu trúc

- `mobile/`: Expo SDK 57, React Native, Android 7 trở lên.
- `api/`: Express 5, parser Excel, PostgreSQL và API ảnh.
- `api/db/schema.sql`: schema idempotent cho danh sách, cây gỗ và ảnh.

Điện thoại không kết nối trực tiếp tới PostgreSQL. Chỉ máy chủ API được giữ `DATABASE_URL`.

## File Excel đang hỗ trợ

Parser tự tìm dòng tiêu đề trong 25 dòng đầu và nhận các tên cột tương đương. File mẫu đã được xác minh với:

- Sheet: `LS-PL NANA`
- Dòng tiêu đề: 3
- `Log No.`: cột D
- `Lg (m)`: cột F
- `Ømoy (cm)`: cột G
- `Vol. (CBM)`: cột H
- 83 cây, tổng 361,954609 CBM

Dòng `Total/Average`, dòng trống và phần ký tên bị loại khỏi dữ liệu cây.

## Chạy API

Tạo `api/.env` từ `api/.env.example`, sau đó:

```powershell
npm install
npm run db:migrate
npm run dev:api
```

API mặc định chạy tại `http://0.0.0.0:4000`. Có thể đặt `APP_API_KEY`; app sẽ gửi giá trị tương ứng qua `EXPO_PUBLIC_API_KEY`.

## Chạy Android

Tạo `mobile/.env` từ `mobile/.env.example`.

- Máy Android thật: đặt `EXPO_PUBLIC_API_URL` thành IP LAN của máy chạy API, ví dụ `http://192.168.1.10:4000`.
- Android Emulator: mặc định dùng `http://10.0.2.2:4000`.
- API đã triển khai: dùng URL HTTPS công khai.

```powershell
npm run dev:mobile
```

Mở Expo Go trên Android và quét QR. Để tạo file APK cài trực tiếp:

```powershell
cd mobile
npx eas build --platform android --profile preview
```

## Triển khai API

Dockerfile dùng build context ở thư mục gốc:

```powershell
docker build -f api/Dockerfile -t app-nhap-go-api .
docker run --rm -p 4000:4000 --env-file api/.env app-nhap-go-api
```

Khi đưa lên Render, Railway hoặc VPS, cấu hình `DATABASE_URL`, `APP_API_KEY` và `CORS_ORIGIN` bằng secret của nền tảng. Không đưa các giá trị thật vào Git.

## Kiểm tra

```powershell
npm run test
npm run typecheck
npm run build:api
```

Unit test bao phủ nhận diện dòng tiêu đề, ánh xạ cột, bỏ dòng tổng và chống trùng Log trong cùng workbook. API còn chống nhập trùng toàn bộ file bằng SHA-256 và chống lưu trùng ảnh cho cùng một cây.

