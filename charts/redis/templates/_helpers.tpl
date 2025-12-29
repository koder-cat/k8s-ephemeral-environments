{{/*
Expand the name of the chart.
*/}}
{{- define "redis.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "redis.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "redis.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "redis.labels" -}}
helm.sh/chart: {{ include "redis.chart" . }}
{{ include "redis.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/component: cache
{{- end }}

{{/*
Selector labels
*/}}
{{- define "redis.selectorLabels" -}}
app.kubernetes.io/name: {{ include "redis.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Secret name for Redis credentials
*/}}
{{- define "redis.secretName" -}}
{{- printf "%s-secret" (include "redis.fullname" .) }}
{{- end }}

{{/*
Service name for Redis
*/}}
{{- define "redis.serviceName" -}}
{{- include "redis.fullname" . }}
{{- end }}

{{/*
Environment variables for Redis connection
Use this template in your application deployment to inject Redis credentials:

  env:
    {{- include "redis.envVars" .Subcharts.redis | nindent 4 }}

This injects:
  - REDIS_HOST: Redis host
  - REDIS_PORT: Redis port
  - REDIS_PASSWORD: Redis password (only when auth.enabled)
  - REDIS_URL: Full connection URL (only when auth.disabled, apps should construct URL when auth is enabled)
*/}}
{{- define "redis.envVars" -}}
{{- if .Values.enabled }}
- name: REDIS_HOST
  value: {{ include "redis.serviceName" . | quote }}
- name: REDIS_PORT
  value: "6379"
{{- if .Values.auth.enabled }}
- name: REDIS_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ include "redis.secretName" . }}
      key: password
# When auth is enabled, apps should construct REDIS_URL from components:
# redis://:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}
{{- else }}
- name: REDIS_URL
  value: "redis://{{ include "redis.serviceName" . }}:6379"
{{- end }}
{{- end }}
{{- end }}

{{/*
Environment variables with custom prefix
*/}}
{{- define "redis.envVarsWithPrefix" -}}
{{- $prefix := .prefix | default "REDIS" }}
{{- $ctx := .context }}
{{- if $ctx.Values.enabled }}
- name: {{ $prefix }}_HOST
  value: {{ include "redis.serviceName" $ctx | quote }}
- name: {{ $prefix }}_PORT
  value: "6379"
{{- if $ctx.Values.auth.enabled }}
- name: {{ $prefix }}_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ include "redis.secretName" $ctx }}
      key: password
{{- end }}
{{- end }}
{{- end }}
