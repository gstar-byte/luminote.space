[void][System.Reflection.Assembly]::LoadWithPartialName("System.Drawing")

function GenerateIcon([int]$size, [string]$outputPath) {
    # 创建对应尺寸的位图
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    # 计算缩放比例 (基于 96x96 比例设计)
    $scale = $size / 96.0

    # 1. 绘制便签主体多边形 (白色填充)
    # 96 坐标下的顶点：(18, 14), (78, 14), (78, 54), (54, 78), (18, 78)
    $p1 = New-Object System.Drawing.PointF ((18 * $scale), (14 * $scale))
    $p2 = New-Object System.Drawing.PointF ((78 * $scale), (14 * $scale))
    $p3 = New-Object System.Drawing.PointF ((78 * $scale), (54 * $scale))
    $p4 = New-Object System.Drawing.PointF ((54 * $scale), (78 * $scale))
    $p5 = New-Object System.Drawing.PointF ((18 * $scale), (78 * $scale))
    
    $points = @($p1, $p2, $p3, $p4, $p5)
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.FillPolygon($brush, $points)

    # 2. 绘制右下角折角折起的三角形 (白色填充)
    # 96 坐标下的顶点：(58, 58), (58, 78), (78, 58)
    $t1 = New-Object System.Drawing.PointF ((58 * $scale), (58 * $scale))
    $t2 = New-Object System.Drawing.PointF ((58 * $scale), (78 * $scale))
    $t3 = New-Object System.Drawing.PointF ((78 * $scale), (58 * $scale))
    
    $trianglePoints = @($t1, $t2, $t3)
    $g.FillPolygon($brush, $trianglePoints)

    # 3. 设置绘图混合模式为 SourceCopy (直接拷贝源颜色，涂透明色相当于擦除)
    $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $clearPen = New-Object System.Drawing.Pen([System.Drawing.Color]::Transparent, (4 * $scale))
    $clearPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $clearPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    # 4. 擦除三条横线代表列表项
    # 第一条线：X (28->68), Y = 30
    $g.DrawLine($clearPen, (28 * $scale), (30 * $scale), (68 * $scale), (30 * $scale))
    # 第二条线：X (28->68), Y = 42
    $g.DrawLine($clearPen, (28 * $scale), (42 * $scale), (68 * $scale), (42 * $scale))
    # 第三条线：X (28->50), Y = 54
    $g.DrawLine($clearPen, (28 * $scale), (54 * $scale), (50 * $scale), (54 * $scale))

    # 释放绘图资源
    $clearPen.Dispose()
    $brush.Dispose()
    $g.Dispose()

    # 确保父目录存在
    $parentDir = [System.IO.Path]::GetDirectoryName($outputPath)
    if (-not (Test-Path $parentDir)) {
        New-Item -ItemType Directory -Force -Path $parentDir | Out-Null
    }

    # 保存为 PNG
    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    
    Write-Host "Generated: $outputPath ($size x $size)"
}

# 项目基础目录
$projectDir = "f:\26年4月\luminote.space\mobile"

# 1. 生成公共的 96x96 monochrome 资产图片
GenerateIcon 96 "$projectDir\assets\images\android-icon-monochrome.png"

# 2. 生成原生 Android 不同分辨率目录下的 notification_icon.png
$resDir = "$projectDir\android\app\src\main\res"

GenerateIcon 24 "$resDir\drawable-mdpi\notification_icon.png"
GenerateIcon 36 "$resDir\drawable-hdpi\notification_icon.png"
GenerateIcon 48 "$resDir\drawable-xhdpi\notification_icon.png"
GenerateIcon 72 "$resDir\drawable-xxhdpi\notification_icon.png"
GenerateIcon 96 "$resDir\drawable-xxxhdpi\notification_icon.png"
