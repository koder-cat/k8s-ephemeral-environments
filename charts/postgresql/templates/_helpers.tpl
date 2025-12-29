{{/*
Expand the name of the chart.
*/}}
{{- define "postgresql.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
*/}}
{{- define "postgresql.fullname" -}}
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
{{- define "postgresql.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "postgresql.labels" -}}
helm.sh/chart: {{ include "postgresql.chart" . }}
{{ include "postgresql.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/component: database
{{- end }}

{{/*
Selector labels
*/}}
{{- define "postgresql.selectorLabels" -}}
app.kubernetes.io/name: {{ include "postgresql.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Secret name for application credentials
CloudNativePG creates a secret named {cluster}-app with connection details
*/}}
{{- define "postgresql.secretName" -}}
{{- printf "%s-app" (include "postgresql.fullname" .) }}
{{- end }}

{{/*
Service name for the PostgreSQL cluster
CloudNativePG creates services: {cluster}-rw (read-write), {cluster}-ro (read-only), {cluster}-r (any)
*/}}
{{- define "postgresql.serviceName" -}}
{{- printf "%s-rw" (include "postgresql.fullname" .) }}
{{- end }}

{{/*
Environment variables for PostgreSQL connection
Use this template in your application deployment to inject database credentials:

  env:
    {{- include "postgresql.envVars" .Subcharts.postgresql | nindent 4 }}

Or if using the chart directly:
  env:
    {{- include "postgresql.envVars" . | nindent 4 }}

This injects:
  - DATABASE_URL: Full connection URI (postgresql://user:pass@host:5432/db)
  - PGHOST: Database host
  - PGPORT: Database port
  - PGDATABASE: Database name
  - PGUSER: Database user
  - PGPASSWORD: Database password
*/}}
{{- define "postgresql.envVars" -}}
{{- if .Values.enabled }}
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: {{ include "postgresql.secretName" . }}
      key: uri
- name: PGHOST
  valueFrom:
    secretKeyRef:
      name: {{ include "postgresql.secretName" . }}
      key: host
- name: PGPORT
  valueFrom:
    secretKeyRef:
      name: {{ include "postgresql.secretName" . }}
      key: port
- name: PGDATABASE
  valueFrom:
    secretKeyRef:
      name: {{ include "postgresql.secretName" . }}
      key: dbname
- name: PGUSER
  valueFrom:
    secretKeyRef:
      name: {{ include "postgresql.secretName" . }}
      key: user
- name: PGPASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ include "postgresql.secretName" . }}
      key: password
{{- end }}
{{- end }}

{{/*
Environment variables with custom prefix
Use when you need multiple databases or custom naming:

  env:
    {{- include "postgresql.envVarsWithPrefix" (dict "context" .Subcharts.postgresql "prefix" "PRIMARY_DB") | nindent 4 }}
*/}}
{{- define "postgresql.envVarsWithPrefix" -}}
{{- $prefix := .prefix | default "DB" }}
{{- $ctx := .context }}
{{- if $ctx.Values.enabled }}
- name: {{ $prefix }}_URL
  valueFrom:
    secretKeyRef:
      name: {{ include "postgresql.secretName" $ctx }}
      key: uri
- name: {{ $prefix }}_HOST
  valueFrom:
    secretKeyRef:
      name: {{ include "postgresql.secretName" $ctx }}
      key: host
- name: {{ $prefix }}_PORT
  valueFrom:
    secretKeyRef:
      name: {{ include "postgresql.secretName" $ctx }}
      key: port
- name: {{ $prefix }}_NAME
  valueFrom:
    secretKeyRef:
      name: {{ include "postgresql.secretName" $ctx }}
      key: dbname
- name: {{ $prefix }}_USER
  valueFrom:
    secretKeyRef:
      name: {{ include "postgresql.secretName" $ctx }}
      key: user
- name: {{ $prefix }}_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ include "postgresql.secretName" $ctx }}
      key: password
{{- end }}
{{- end }}
