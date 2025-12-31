{{/*
Expand the name of the chart.
*/}}
{{- define "mariadb.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "mariadb.fullname" -}}
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
{{- define "mariadb.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "mariadb.labels" -}}
helm.sh/chart: {{ include "mariadb.chart" . }}
{{ include "mariadb.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/component: database
{{- end }}

{{/*
Selector labels
*/}}
{{- define "mariadb.selectorLabels" -}}
app.kubernetes.io/name: {{ include "mariadb.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Secret name for MariaDB credentials
*/}}
{{- define "mariadb.secretName" -}}
{{- printf "%s-secret" (include "mariadb.fullname" .) }}
{{- end }}

{{/*
Service name for MariaDB
*/}}
{{- define "mariadb.serviceName" -}}
{{- include "mariadb.fullname" . }}
{{- end }}

{{/*
Environment variables for MariaDB connection
Use this template in your application deployment to inject database credentials:

  env:
    {{- include "mariadb.envVars" .Subcharts.mariadb | nindent 4 }}

This injects:
  - MYSQL_HOST: Database host
  - MYSQL_PORT: Database port
  - MYSQL_DATABASE: Database name
  - MYSQL_USER: Database user
  - MYSQL_PASSWORD: Database password
  - MYSQL_URL: Full connection URL (mysql://user:pass@host:3306/db)
*/}}
{{- define "mariadb.envVars" -}}
{{- if .Values.enabled }}
- name: MYSQL_HOST
  value: {{ include "mariadb.serviceName" . | quote }}
- name: MYSQL_PORT
  value: "3306"
- name: MYSQL_DATABASE
  value: {{ .Values.database | default "app" | quote }}
- name: MYSQL_USER
  value: {{ .Values.username | default "app" | quote }}
- name: MYSQL_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ include "mariadb.secretName" . }}
      key: user-password
- name: MYSQL_URL
  valueFrom:
    secretKeyRef:
      name: {{ include "mariadb.secretName" . }}
      key: connection-url
{{- end }}
{{- end }}

{{/*
Environment variables with custom prefix
Use when you need multiple databases or custom naming:

  env:
    {{- include "mariadb.envVarsWithPrefix" (dict "context" .Subcharts.mariadb "prefix" "PRIMARY_DB") | nindent 4 }}
*/}}
{{- define "mariadb.envVarsWithPrefix" -}}
{{- $prefix := .prefix | default "MYSQL" }}
{{- $ctx := .context }}
{{- if $ctx.Values.enabled }}
- name: {{ $prefix }}_HOST
  value: {{ include "mariadb.serviceName" $ctx | quote }}
- name: {{ $prefix }}_PORT
  value: "3306"
- name: {{ $prefix }}_DATABASE
  value: {{ $ctx.Values.database | default "app" | quote }}
- name: {{ $prefix }}_USER
  value: {{ $ctx.Values.username | default "app" | quote }}
- name: {{ $prefix }}_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ include "mariadb.secretName" $ctx }}
      key: user-password
- name: {{ $prefix }}_URL
  valueFrom:
    secretKeyRef:
      name: {{ include "mariadb.secretName" $ctx }}
      key: connection-url
{{- end }}
{{- end }}
