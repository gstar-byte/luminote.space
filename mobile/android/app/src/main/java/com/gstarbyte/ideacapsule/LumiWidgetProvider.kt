package com.gstarbyte.ideacapsule

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

class LumiWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    private fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
        val views = RemoteViews(context.packageName, R.layout.lumi_widget_layout)

        // Intent for standard Quick Capture (Text or generic capture)
        val textIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        if (textIntent != null) {
            textIntent.apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                data = Uri.parse("luminote://quick-capture")
            }
            val textPendingIntent = PendingIntent.getActivity(
                context,
                100,
                textIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_search_bar, textPendingIntent)
            views.setOnClickPendingIntent(R.id.btn_widget_add, textPendingIntent)
        }

        // Intent for Voice Quick Capture
        val voiceIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        if (voiceIntent != null) {
            voiceIntent.apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                data = Uri.parse("luminote://quick-capture?mode=voice")
            }
            val voicePendingIntent = PendingIntent.getActivity(
                context,
                101,
                voiceIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.btn_widget_voice, voicePendingIntent)
        }

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }
}
