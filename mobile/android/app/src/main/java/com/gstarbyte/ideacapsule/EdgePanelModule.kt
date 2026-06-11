package com.gstarbyte.ideacapsule

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.*

class EdgePanelModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "EdgePanelModule"

    @ReactMethod
    fun hasOverlayPermission(promise: Promise) {
        val context = reactApplicationContext
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            promise.resolve(Settings.canDrawOverlays(context))
        } else {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun requestOverlayPermission(promise: Promise) {
        val context = reactApplicationContext
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(context)) {
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:${context.packageName}")
                ).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
                promise.resolve(false)
            } else {
                promise.resolve(true)
            }
        } else {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun enableEdgePanel(enabled: Boolean) {
        val context = reactApplicationContext
        val intent = Intent(context, EdgePanelService::class.java)
        
        setEdgePanelSavedState(enabled)

        if (enabled) {
            context.startService(intent)
        } else {
            context.stopService(intent)
        }
    }

    @ReactMethod
    fun isEdgePanelEnabled(promise: Promise) {
        val sharedPref = reactApplicationContext.getSharedPreferences("luminote_prefs", Context.MODE_PRIVATE)
        val isEnabled = sharedPref.getBoolean("edge_panel_enabled", false)
        promise.resolve(isEnabled)
    }

    private fun setEdgePanelSavedState(enabled: Boolean) {
        val sharedPref = reactApplicationContext.getSharedPreferences("luminote_prefs", Context.MODE_PRIVATE)
        with(sharedPref.edit()) {
            putBoolean("edge_panel_enabled", enabled)
            apply()
        }
    }
}
