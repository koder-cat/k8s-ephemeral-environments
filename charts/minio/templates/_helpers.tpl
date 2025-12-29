{{/*
Expand the name of the chart.
*/}}
{{- define "minio.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "minio.fullname" -}}
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
{{- define "minio.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "minio.labels" -}}
helm.sh/chart: {{ include "minio.chart" . }}
{{ include "minio.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/component: storage
{{- end }}

{{/*
Selector labels
*/}}
{{- define "minio.selectorLabels" -}}
app.kubernetes.io/name: {{ include "minio.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Secret name for MinIO credentials
*/}}
{{- define "minio.secretName" -}}
{{- printf "%s-secret" (include "minio.fullname" .) }}
{{- end }}

{{/*
Service name for MinIO (headless service for internal cluster access)
MinIO Operator creates: {tenant-name}-hl on port 9000 for S3 API
*/}}
{{- define "minio.serviceName" -}}
{{- printf "%s-hl" (include "minio.fullname" .) }}
{{- end }}

{{/*
Environment variables for MinIO connection
Use this template in your application deployment to inject S3 credentials:

  env:
    {{- include "minio.envVars" .Subcharts.minio | nindent 4 }}

This injects:
  - S3_ENDPOINT: MinIO endpoint URL
  - S3_ACCESS_KEY: Access key
  - S3_SECRET_KEY: Secret key
  - S3_BUCKET: Default bucket name
*/}}
{{- define "minio.envVars" -}}
{{- if .Values.enabled }}
- name: S3_ENDPOINT
  value: "http://{{ include "minio.serviceName" . }}:9000"
- name: S3_ACCESS_KEY
  valueFrom:
    secretKeyRef:
      name: {{ include "minio.secretName" . }}
      key: accesskey
- name: S3_SECRET_KEY
  valueFrom:
    secretKeyRef:
      name: {{ include "minio.secretName" . }}
      key: secretkey
- name: S3_BUCKET
  value: {{ .Values.bucket | default "data" | quote }}
{{- end }}
{{- end }}

{{/*
Environment variables with custom prefix
*/}}
{{- define "minio.envVarsWithPrefix" -}}
{{- $prefix := .prefix | default "MINIO" }}
{{- $ctx := .context }}
{{- if $ctx.Values.enabled }}
- name: {{ $prefix }}_ENDPOINT
  value: "http://{{ include "minio.serviceName" $ctx }}:9000"
- name: {{ $prefix }}_ACCESS_KEY
  valueFrom:
    secretKeyRef:
      name: {{ include "minio.secretName" $ctx }}
      key: accesskey
- name: {{ $prefix }}_SECRET_KEY
  valueFrom:
    secretKeyRef:
      name: {{ include "minio.secretName" $ctx }}
      key: secretkey
- name: {{ $prefix }}_BUCKET
  value: {{ $ctx.Values.bucket | default "data" | quote }}
{{- end }}
{{- end }}
