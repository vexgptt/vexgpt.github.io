<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Instagram User Info</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f8f9fa;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #fff;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            font-weight: bold;
            margin-bottom: 5px;
        }
        input[type="text"] {
            width: 100%;
            padding: 10px;
            font-size: 16px;
            border: 1px solid #ccc;
            border-radius: 4px;
        }
        button[type="submit"] {
            padding: 10px 20px;
            font-size: 16px;
            background-color: #4caf50;
            color: #fff;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        button[type="submit"]:hover {
            background-color: #45a049;
        }
        .user-info {
            margin-top: 20px;
            text-align: center;
        }
        .gif-container {
            text-align: center;
            margin-top: 50px;
        }
    </style>
</head>
<body>

<div class="container">
    <h1 style="text-align: center;">Instagram User Info</h1>

    <!-- Kullanıcı Adı Giriş Formu -->
    <form method="GET" action="">
        <div class="form-group">
            <label for="username">Kullanıcı Adı:</label>
            <input type="text" id="username" name="username" required>
        </div>
        
        <button type="submit">Gönder</button>
    </form>

    <?php
    if (isset($_GET['username'])) {
        $username = $_GET['username'];
        // Burada gönderi sayısını almak için bir mekanizma ekleyebilirsiniz, örneğin Instagram API kullanarak.
    ?>
    <div class="user-info">
        <!-- Instagram Embed -->
        <blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/<?= $username ?>/" data-instgrm-version="13"></blockquote>
        <script async src="//www.instagram.com/embed.js"></script>
    </div>
    <?php } ?>

    <!-- Eklenmiş GIF -->
    <div class="gif-container">
        <img src="https://www.yzlm.com.tr/wp-content/uploads/2023/05/1-instagram.gif" alt="Instagram GIF" style="max-width: 100%; height: auto;">
    </div>
</div>

</body>
</html>
