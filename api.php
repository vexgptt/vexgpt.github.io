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
        }
        form {
            margin-bottom: 20px;
        }
        label {
            font-weight: bold;
        }
        input[type="text"] {
            padding: 5px;
            margin-right: 10px;
        }
        button {
            padding: 5px 10px;
            background-color: #4CAF50;
            color: white;
            border: none;
            cursor: pointer;
        }
        button:hover {
            background-color: #45a049;
        }
        .user-info {
            margin-bottom: 20px;
        }
        .user-info img {
            border-radius: 50%;
        }
        .user-info h3 {
            margin-top: 10px;
            margin-bottom: 5px;
            cursor: pointer;
        }
        .user-info p {
            margin: 5px 0;
        }
        .posts {
            display: flex;
            flex-wrap: wrap;
        }
        .posts img {
            margin: 5px;
            max-width: 200px;
        }
        .error {
            color: red;
        }
    </style>
</head>
<body>

<!-- Kullanıcı Adı ve Gönderi Sayısı Giriş Formu -->
<form method="GET" action="">
    <label for="username">Kullanıcı Adı:</label>
    <input type="text" id="username" name="username" required>
    <label for="post_count">Gönderi Sayısı:</label>
    <input type="text" id="post_count" name="post_count" required>
    <button type="submit">Gönder</button>
</form>

<?php
if (isset($_GET['username'])) {
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => 'https://www.instagram.com/' . $_GET['username'] . '/embed/',
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Linux; Android 6.0.1; SM-G935S Build/MMB29K; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/55.0.2883.91 Mobile Safari/537.36',
        CURLOPT_RETURNTRANSFER => true
    ]);
    $output = curl_exec($ch);
    curl_close($ch);

    if (strpos($output, 'Sorry, this page isn&#39;t available.') !== false) {
        echo '<p class="error">Hata: Bu kullanıcı adıyla ilgili sayfa bulunamadı.</p>';
    } else {
        $username = $_GET['username'];
        $followers = 0;
        $postCount = 0;
        $posts = [];

        $regex = '@\\\"owner\\\":{\\\"id\\\":\\\"([0-9]+)\\\",\\\"profile_pic_url\\\":\\\"(.*?)\\\",\\\"username\\\":\\\"(.*?)\\\",\\\"followed_by_viewer\\\":(true|false),\\\"has_public_story\\\":(true|false),\\\"is_private\\\":(true|false),\\\"is_unpublished\\\":(true|false),\\\"is_verified\\\":(true|false),\\\"edge_followed_by\\\":{\\\"count\\\":([0-9]+)},\\\"edge_owner_to_timeline_media\\\":{\\\"count\\\":([0-9]+)@';
        preg_match($regex, $output, $result);

        if (isset($result[9])) {
            $followers = $result[9];
        }
        if (isset($result[10])) {
            $postCount = $result[10];
        }

        preg_match_all('@\\\"thumbnail_src\\\":\\\"(.*?)\\\"@', $output, $result);
        $desiredPostCount = $_GET['post_count'];
        $posts = array_map(function ($image) {
            return str_replace('\\\\\\', '', $image);
        }, array_slice($result[1], 0, $desiredPostCount));

        ?>

        <div class="user-info">
            <!-- Profil Resmi -->
            <a href="https://www.instagram.com/<?= $username ?>" target="_blank">
                <img src="<?= $result[2][0] ?>" alt="Profil Resmi" width="150">
            </a>
            <!-- Kullanıcı Adı -->
            <h3><?= $username ?></h3>
            <!-- Takipçi ve Gönderi Sayısı -->
            <p>Takipçi: <?= $followers ?> - Gönderi: <?= $postCount ?></p>
        </div>

        <!-- Son Gönderiler ve Videolar -->
        <div class="posts">
            <?php foreach ($posts as $index => $post): ?>
                <a href="<?= $post ?>" target="_blank">
                    <img src="<?= $post ?>" alt="Gönderi">
                </a>
            <?php endforeach; ?>
        </div>

        <?php
    }
}
?>

</body>
</html>
