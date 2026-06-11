package com.gstarbyte.ideacapsule

import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.IBinder
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import kotlin.math.abs

class EdgePanelService : Service() {

    companion object {
        var isAppActive = false
    }

    private var windowManager: WindowManager? = null
    private var edgeBar: FrameLayout? = null
    private var params: WindowManager.LayoutParams? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        createEdgeBar()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        if (action == "ACTION_HIDE_EDGE_BAR") {
            isAppActive = true
            edgeBar?.visibility = View.GONE
        } else if (action == "ACTION_SHOW_EDGE_BAR") {
            isAppActive = false
            val sharedPref = getSharedPreferences("luminote_prefs", Context.MODE_PRIVATE)
            val isEnabled = sharedPref.getBoolean("edge_panel_enabled", false)
            edgeBar?.visibility = if (isEnabled) View.VISIBLE else View.GONE
        }
        return START_STICKY
    }

    private fun createEdgeBar() {
        val ctx = this
        val density = resources.displayMetrics.density
        val barWidth = (4 * density).toInt()
        val barHeight = (90 * density).toInt()

        edgeBar = FrameLayout(ctx)
        
        val drawable = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            colors = intArrayOf(Color.parseColor("#A0007AFF"), Color.parseColor("#D000F0FF"))
            gradientType = GradientDrawable.LINEAR_GRADIENT
            orientation = GradientDrawable.Orientation.TL_BR
            cornerRadius = 2 * density
        }
        
        val innerBar = View(ctx).apply {
            background = drawable
            alpha = 0.25f
        }
        
        val layoutParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        )
        
        edgeBar?.addView(innerBar, layoutParams)

        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        params = WindowManager.LayoutParams(
            barWidth,
            barHeight,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.END or Gravity.CENTER_VERTICAL
            x = 0
            y = 0
        }

        // 根据前后台状态设置初始可见性
        if (isAppActive) {
            edgeBar?.visibility = View.GONE
        } else {
            val sharedPref = getSharedPreferences("luminote_prefs", Context.MODE_PRIVATE)
            val isEnabled = sharedPref.getBoolean("edge_panel_enabled", false)
            edgeBar?.visibility = if (isEnabled) View.VISIBLE else View.GONE
        }

        edgeBar?.setOnTouchListener(object : View.OnTouchListener {
            private var initialY = 0
            private var initialTouchX = 0.0f
            private var initialTouchY = 0.0f
            private var isMovingY = false
            private var isSlideTriggered = false
            private val clickThreshold = 5 * density
            private val dragThreshold = 10 * density
            private val slideThreshold = -8 * density
            private var touchDownTime = 0L

            override fun onTouch(v: View?, event: MotionEvent?): Boolean {
                if (event == null || params == null) return false
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        initialY = params!!.y
                        initialTouchX = event.rawX
                        initialTouchY = event.rawY
                        isMovingY = false
                        isSlideTriggered = false
                        touchDownTime = System.currentTimeMillis()
                        innerBar.alpha = 0.8f
                        return true
                    }
                    MotionEvent.ACTION_MOVE -> {
                        val deltaX = event.rawX - initialTouchX
                        val deltaY = event.rawY - initialTouchY
                        
                        // 1. 优先判定向左滑动拉起快捷录入：向左滑过 8dp，并且水平左滑趋势明显大于垂直偏位
                        if (deltaX < slideThreshold && !isSlideTriggered && !isMovingY) {
                            if (abs(deltaX) > abs(deltaY)) {
                                isSlideTriggered = true
                                launchQuickCapture()
                                return true
                            }
                        }
                        
                        // 2. 拖拽位置判定：垂直偏位超过 10dp
                        if (!isSlideTriggered && !isMovingY && abs(deltaY) > dragThreshold) {
                            isMovingY = true
                        }
                        if (isMovingY) {
                            params!!.y = initialY + deltaY.toInt()
                            windowManager?.updateViewLayout(edgeBar, params)
                        }
                        return true
                    }
                    MotionEvent.ACTION_UP -> {
                        innerBar.alpha = 0.25f
                        val duration = System.currentTimeMillis() - touchDownTime
                        if (!isSlideTriggered && !isMovingY) {
                            if (abs(event.rawY - initialTouchY) < clickThreshold && duration < 300) {
                                launchQuickCapture()
                            }
                        }
                        return true
                    }
                }
                return false
            }
        })

        try {
            windowManager?.addView(edgeBar, params)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun launchQuickCapture() {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        if (launchIntent != null) {
            launchIntent.apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                data = android.net.Uri.parse("luminote://quick-capture")
            }
            startActivity(launchIntent)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (edgeBar != null) {
            try {
                windowManager?.removeView(edgeBar)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}
